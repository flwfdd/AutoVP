#!/usr/bin/env python3
"""
通用Flow节点SDK - 每种节点类型只有一个通用函数
通过配置参数来定制节点行为，避免重复代码
"""

import json
import os
import base64
import asyncio
import aiohttp
import aiofiles
import tempfile
import hashlib
import logging
from typing import Any, Dict, Optional, Union, List
from pathlib import Path
from urllib.parse import urlparse


# =============================================================================
# 核心工具函数
# =============================================================================

async def llm_call(model: str, system_prompt: str, user_prompt: str) -> str:
    """调用LLM API"""
    try:
        api_key = os.getenv('OPENAI_API_KEY')
        api_base = os.getenv('OPENAI_API_BASE_URL', 'https://api.openai.com/v1')
        
        if not api_key:
            return "错误: 未设置OPENAI_API_KEY环境变量"
            
        async with aiohttp.ClientSession() as session:
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                'model': model,
                'messages': [
                    {'role': 'system', 'content': system_prompt},
                    {'role': 'user', 'content': user_prompt}
                ]
            }
            
            async with session.post(f'{api_base}/chat/completions', 
                                   headers=headers, 
                                   json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    return result['choices'][0]['message']['content']
                else:
                    error_text = await response.text()
                    return f"LLM调用错误 ({response.status}): {error_text}"
                    
    except Exception as e:
        return f"LLM调用错误: {str(e)}"


async def execute_python_code(code: str, params: Dict[str, Any]) -> Any:
    """执行Python代码"""
    try:
        exec_globals = {
            "json": json,
            "os": os,
            "base64": base64,
            "hashlib": hashlib,
            "asyncio": asyncio,
        }
        exec_locals = {}
        
        exec(code, exec_globals, exec_locals)
        
        if 'main' in exec_locals:
            main_func = exec_locals['main']
            if asyncio.iscoroutinefunction(main_func):
                return await main_func(**params)
            else:
                return main_func(**params)
        else:
            return "错误: 代码中未找到main函数"
            
    except Exception as e:
        return f"Python代码执行错误: {str(e)}"


async def execute_javascript_code(code: str, params: Dict[str, Any]) -> Any:
    """执行JavaScript代码"""
    try:
        params_json = json.dumps(params, ensure_ascii=False)
        
        # 将JavaScript参数作为全局变量注入
        param_assignments = []
        for key, value in params.items():
            param_assignments.append(f"const {key} = {json.dumps(value, ensure_ascii=False)};")
        
        full_code = f"""
{chr(10).join(param_assignments)}

// 用户代码
const userCode = async () => {{
{code}
}};

async function run() {{
    try {{
        let result;
        if (typeof main === 'function') {{
            const paramValues = Object.values({params_json});
            result = await main(...paramValues);
        }} else {{
            // 执行用户代码
            result = await userCode();
        }}
        console.log(JSON.stringify(result, null, 0));
    }} catch (error) {{
        console.error(JSON.stringify({{error: error.message}}, null, 0));
    }}
}}

run();
"""
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False, encoding='utf-8') as f:
            f.write(full_code)
            temp_file = f.name
            
        try:
            result = await asyncio.create_subprocess_exec(
                'node', temp_file,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(result.communicate(), timeout=30)
            
            if result.returncode == 0:
                output = stdout.decode('utf-8').strip()
                try:
                    return json.loads(output)
                except json.JSONDecodeError:
                    return output
            else:
                error_msg = stderr.decode('utf-8')
                return f"JavaScript执行错误: {error_msg}"
                
        finally:
            os.unlink(temp_file)
            
    except asyncio.TimeoutError:
        return "错误: JavaScript代码执行超时"
    except FileNotFoundError:
        return "错误: 未找到Node.js，请确保已安装"
    except Exception as e:
        return f"JavaScript代码执行错误: {str(e)}"


async def save_image(src: str, node_id: str) -> str:
    """保存图像文件"""
    try:
        images_dir = Path("images")
        images_dir.mkdir(exist_ok=True)
        
        if src.startswith('data:image/'):
            header, data = src.split(',', 1)
            image_data = base64.b64decode(data)
            
            if 'png' in header:
                ext = 'png'
            elif 'jpeg' in header or 'jpg' in header:
                ext = 'jpg'
            elif 'gif' in header:
                ext = 'gif'
            else:
                ext = 'png'
                
            filename = f"{node_id}_{hash(src) % 100000}.{ext}"
            filepath = images_dir / filename
            
            async with aiofiles.open(filepath, 'wb') as f:
                await f.write(image_data)
                
            return str(filepath)
            
        elif src.startswith(('http://', 'https://')):
            async with aiohttp.ClientSession() as session:
                async with session.get(src) as response:
                    if response.status == 200:
                        content = await response.read()
                        
                        content_type = response.headers.get('content-type', '')
                        if 'png' in content_type:
                            ext = 'png'
                        elif 'jpeg' in content_type or 'jpg' in content_type:
                            ext = 'jpg'
                        elif 'gif' in content_type:
                            ext = 'gif'
                        else:
                            parsed = urlparse(src)
                            path_ext = Path(parsed.path).suffix.lower()
                            ext = path_ext[1:] if path_ext in ['.png', '.jpg', '.jpeg', '.gif'] else 'png'
                            
                        filename = f"{node_id}_{hash(src) % 100000}.{ext}"
                        filepath = images_dir / filename
                        
                        async with aiofiles.open(filepath, 'wb') as f:
                            await f.write(content)
                            
                        return str(filepath)
                    else:
                        return f"错误: 无法下载图像 (HTTP {response.status})"
        else:
            if os.path.exists(src):
                return src
            else:
                return f"错误: 文件不存在 {src}"
                
    except Exception as e:
        return f"图像保存错误: {str(e)}"


# =============================================================================
# 通用节点函数 - 每种类型只有一个
# =============================================================================

async def start_node(config: Dict[str, Any], input_data: Any = None) -> Any:
    """通用开始节点"""
    # 开始节点直接返回输入数据
    return input_data


async def end_node(config: Dict[str, Any], input_data: Any) -> Any:
    """通用结束节点"""
    # 结束节点直接返回输入数据
    return input_data


async def text_node(config: Dict[str, Any]) -> str:
    """通用文本节点"""
    text_content = config.get('text', '')
    return text_content


async def display_node(config: Dict[str, Any], input_data: Any) -> Any:
    """通用显示节点"""
    name = config.get('name', 'Display')
    print(f"[{name}] 显示: {input_data}")
    return input_data


async def llm_node(config: Dict[str, Any], prompt: str) -> str:
    """通用LLM节点"""
    system_prompt = config.get('systemPrompt', '')
    model = config.get('model', 'gpt-3.5-turbo')
    
    return await llm_call(model, system_prompt, prompt)


async def python_node(config: Dict[str, Any], **kwargs) -> Any:
    """通用Python节点"""
    code = config.get('code', '')
    param_configs = config.get('params', [])
    
    # 构建参数字典
    params = {}
    for param_config in param_configs:
        param_name = param_config['name']
        if param_name in kwargs:
            params[param_name] = kwargs[param_name]
    
    # 包装代码为main函数格式
    if not code.strip().startswith('def main'):
        param_names = [p['name'] for p in param_configs]
        wrapped_code = f"""def main({', '.join(param_names)}):
{chr(10).join(['    ' + line for line in code.split(chr(10))])}
"""
    else:
        wrapped_code = code
    
    return await execute_python_code(wrapped_code, params)


async def javascript_node(config: Dict[str, Any], **kwargs) -> Any:
    """通用JavaScript节点"""
    code = config.get('code', '')
    param_configs = config.get('params', [])
    
    # 构建参数字典
    params = {}
    for param_config in param_configs:
        param_name = param_config['name']
        if param_name in kwargs:
            params[param_name] = kwargs[param_name]
    
    return await execute_javascript_code(code, params)


async def image_node(config: Dict[str, Any], src: str, node_id: str = None) -> Dict[str, Any]:
    """通用图像节点"""
    if not node_id:
        node_id = config.get('name', 'image').replace(' ', '_')
    
    if src:
        image_path = await save_image(src, node_id)
        name = config.get('name', 'Image')
        print(f"[{name}] 图像已保存: {image_path}")
        return {"image_path": image_path, "src": src}
    else:
        return {"error": "无图像源"}


async def branch_node(config: Dict[str, Any], input_data: Any) -> Dict[str, Any]:
    """通用分支节点"""
    code = config.get('code', '')
    branches = config.get('branches', [])
    
    # 构建分支变量映射
    branch_vars = {}
    for branch in branches:
        branch_vars[branch['name']] = branch['id']
    
    # 准备JavaScript执行环境
    branch_assignments = "; ".join([f"const {name} = '{branch_id}'" 
                                   for name, branch_id in branch_vars.items()])
    
    full_code = f"""
const input = arguments[0];
{branch_assignments};

{code}
"""
    
    result = await execute_javascript_code(full_code, {"input": input_data})
    
    # 处理分支结果
    if isinstance(result, str):
        # 单个分支
        return {"branch": result, "data": input_data}
    elif isinstance(result, list):
        # 多个分支
        return {"branches": result, "data": input_data}
    elif isinstance(result, dict):
        # 分支数据映射
        return {"branch_data": result}
    else:
        raise ValueError(f"分支条件返回值格式错误: {type(result)}")


# =============================================================================
# 节点类型映射
# =============================================================================

NODE_FUNCTIONS = {
    'start': start_node,
    'end': end_node,
    'text': text_node,
    'display': display_node,
    'llm': llm_node,
    'python': python_node,
    'javascript': javascript_node,
    'image': image_node,
    'branch': branch_node,
}


async def execute_node(node_type: str, config: Dict[str, Any], **inputs) -> Any:
    """通用节点执行函数"""
    if node_type not in NODE_FUNCTIONS:
        raise ValueError(f"不支持的节点类型: {node_type}")
    
    node_func = NODE_FUNCTIONS[node_type]
    
    # 根据节点类型处理输入参数
    if node_type == 'start':
        return await node_func(config, inputs.get('input_data'))
    elif node_type == 'text':
        return await node_func(config)
    elif node_type in ['end', 'display']:
        return await node_func(config, inputs.get('input_data'))
    elif node_type == 'llm':
        return await node_func(config, inputs.get('prompt', ''))
    elif node_type in ['python', 'javascript']:
        return await node_func(config, **inputs)
    elif node_type == 'image':
        return await node_func(config, inputs.get('src', ''), inputs.get('node_id'))
    elif node_type == 'branch':
        return await node_func(config, inputs.get('input_data'))
    else:
        return await node_func(config, **inputs)


# =============================================================================
# 便捷函数
# =============================================================================

def log_node_execution(node_id: str, node_type: str, config: Dict[str, Any]):
    """记录节点执行日志"""
    name = config.get('name', f'{node_type}_{node_id}')
    print(f"🔄 执行节点: {name} ({node_type})")


def validate_node_config(node_type: str, config: Dict[str, Any]) -> bool:
    """验证节点配置"""
    required_fields = {
        'llm': ['systemPrompt', 'model'],
        'python': ['code'],
        'javascript': ['code'],
        'text': ['text'],
        'branch': ['code', 'branches']
    }
    
    if node_type in required_fields:
        for field in required_fields[node_type]:
            if field not in config:
                print(f"⚠️  警告: 节点类型 {node_type} 缺少必需字段: {field}")
                return False
    
    return True 