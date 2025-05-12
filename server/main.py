# main.py
import asyncio
import os
import tempfile
import logging
from contextlib import asynccontextmanager

import docker
from docker.errors import APIError, ImageNotFound, NotFound
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# --- Configuration ---
DOCKER_IMAGE_NAME = "python-runner"  # Image built from Dockerfile
EXECUTION_TIMEOUT_SECONDS = 20  # Max execution time for user code
DOCKER_CONTAINER_USER = "appuser" # User inside the Docker container

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Docker client
try:
    docker_client = docker.from_env()
except docker.errors.DockerException as e:
    logger.error(f"Could not connect to Docker daemon: {e}. Please ensure Docker is running.")
    raise SystemExit(f"Docker connection failed: {e}")


# --- Pydantic Models ---
class CodeInput(BaseModel):
    code: str = Field(..., description="Python code to execute.")

class ExecutionResult(BaseModel):
    output: str | None = None
    exit_code: int | None = None
    error: str | None = None
    duration_seconds: float | None = None


# --- FastAPI Lifespan Management ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Application startup...")
    try:
        docker_client.images.get(DOCKER_IMAGE_NAME)
        logger.info(f"Docker image '{DOCKER_IMAGE_NAME}' found.")
    except ImageNotFound:
        logger.warning(f"Docker image '{DOCKER_IMAGE_NAME}' not found. Please build the image manually using the provided Dockerfile.")
    except APIError as e:
        logger.error(f"Could not connect to Docker or other API error: {e}")
        raise SystemExit(f"Docker API error: {e}")

    yield
    logger.info("Application shutdown...")

app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True, # Allows cookies to be included in cross-origin requests
    allow_methods=["*"],  # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allows all headers
)

# --- Helper Function to Run Code in Docker ---
async def run_code_in_docker(user_code: str) -> ExecutionResult:
    # Create a temporary directory for the script on the host
    # This directory will be automatically cleaned up when the 'with' block exits
    with tempfile.TemporaryDirectory(prefix="code_executor_") as temp_dir_host:
        script_path_host = os.path.join(temp_dir_host, "user_script.py")
        script_path_container = "/app/user_script.py"  # Path inside container

        with open(script_path_host, "w", encoding="utf-8") as f:
            f.write(user_code)

        container_name = f"executor_{os.urandom(8).hex()}"
        container = None
        start_time = asyncio.get_event_loop().time()

        try:
            logger.info(f"Running script in container {container_name} from image {DOCKER_IMAGE_NAME}")
            # Run the container in a separate thread to avoid blocking asyncio event loop

            loop = asyncio.get_event_loop()
            container = await loop.run_in_executor(
                None,
                lambda: docker_client.containers.create(
                    image=DOCKER_IMAGE_NAME,
                    command=["python", script_path_container],
                    volumes={
                        script_path_host: {
                            'bind': script_path_container,
                            'mode': 'ro'  # Read-only mount for security
                        }
                    },
                    working_dir="/app",
                    mem_limit="256m",          # Memory limit
                    security_opt=["no-new-privileges"], # Prevent privilege escalation
                    cap_drop=['ALL'],          # Drop all Linux capabilities
                    user=DOCKER_CONTAINER_USER,# Run as non-root user defined in Dockerfile
                    name=container_name,
                )
            )
            await loop.run_in_executor(None, container.start)

            # Wait for container to finish or timeout
            try:
                exit_info = await asyncio.wait_for(
                    loop.run_in_executor(None, container.wait),
                    timeout=EXECUTION_TIMEOUT_SECONDS
                )
                exit_code = exit_info.get('StatusCode', -1)
            except asyncio.TimeoutError:
                logger.warning(f"Container {container_name} execution timed out after {EXECUTION_TIMEOUT_SECONDS}s. Killing.")
                await loop.run_in_executor(None, container.kill)
                # Wait a bit for kill to take effect before trying to get logs
                await asyncio.sleep(0.5)
                return ExecutionResult(
                    error="Execution timed out.",
                    exit_code=-1,
                    duration_seconds=asyncio.get_event_loop().time() - start_time
                )

            output_bytes = await loop.run_in_executor(None, lambda: container.logs(stdout=True, stderr=True))
            output = output_bytes.decode('utf-8', errors='replace')

            duration = asyncio.get_event_loop().time() - start_time
            logger.info(f"Container {container_name} finished. Exit code: {exit_code}, Duration: {duration}s")

            return ExecutionResult(
                output=output,
                exit_code=exit_code,
                error=None,
                duration_seconds=duration,
            )
        except Exception as e:
            logger.error(f"Unexpected error during Docker execution for {container_name}: {str(e)}", exc_info=True)
            duration = asyncio.get_event_loop().time() - start_time
            return ExecutionResult(
                output=None,
                exit_code=None,
                error=str(e),
                duration_seconds=duration
            )
        finally:
            if container:
                try:
                    await loop.run_in_executor(None, lambda: container.remove(force=True))
                    logger.info(f"Container {container_name} removed.")
                except NotFound:
                    logger.info(f"Container {container_name} already removed or not found for removal.")
                except APIError as e_rem:
                    logger.error(f"Error removing container {container_name}: {e_rem}")

# --- API Endpoint ---
@app.post("/python-runner", response_model=ExecutionResult)
async def execute_code_endpoint(payload: CodeInput):
    """
    Executes Python code in an isolated Docker container.
    The environment includes `requests`, `matplotlib`, `numpy`.
    The stdout and stderr are returned.
    """
    if not payload.code.strip():
        raise HTTPException(status_code=400, detail="No code provided.")

    try:
        result = await run_code_in_docker(payload.code)
        if result.error and result.error.startswith("Docker API error:"): # Critical Docker issue
            raise HTTPException(status_code=503, detail=result.error)
        return result
    except Exception as e:
        logger.error(f"Unhandled exception in execute_code_endpoint: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred: {str(e)}")
