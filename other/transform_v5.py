#!/usr/bin/env python3
"""
Flow DSL转换器 v5 - 纯编程模式

设计理念：
1. 完全消除节点和边的概念
2. 生成纯粹的Python函数调用代码
3. 配置参数直接内联到函数调用中
4. name和description作为注释
"""
import json
import os
import shutil
from typing import Dict, List, Any
from pathlib import Path


class FlowTransformerV5:
    """纯编程模式的Flow DSL转换器"""
    
    def __init__(self):
        self.all_flows = {}  # 所有流程
        
    def transform_flow(self, flow_json_path: str, output_dir: str = "output"):
        """转换Flow DSL为纯Python代码"""
        # 读取Flow DSL
        with open(flow_json_path, 'r', encoding='utf-8') as f:
            dsl = json.load(f)
            
        # 创建输出目录
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        print(f"🚀 开始转换 {flow_json_path} ...")
        
        # 解析所有流程
        self._parse_all_flows(dsl)
        
        # 复制通用SDK
        self._copy_universal_sdk(output_path)
        
        # 生成纯编程流程执行器
        self._generate_pure_executor(output_path)
        
        # 生成其他文件
        self._generate_requirements(output_path)
        self._generate_readme(output_path)
        
        print(f"✅ 转换完成！输出目录: {output_path.absolute()}")
        
    def _parse_all_flows(self, dsl: Dict[str, Any]):
        """解析所有流程"""
        main_flow = dsl.get('main', {})
        self.all_flows['main'] = main_flow
        
        sub_flows = dsl.get('flows', [])
        for flow in sub_flows:
            self.all_flows[flow['id']] = flow
            
        print(f"📋 解析到 {len(self.all_flows)} 个流程:")
        for flow_id, flow in self.all_flows.items():
            node_count = len(flow.get('nodes', []))
            print(f"  - {flow_id}: {flow.get('name', 'Unnamed')} ({node_count} 个节点)")
            
    def _copy_universal_sdk(self, output_path: Path):
        """复制通用SDK"""
        source_sdk = Path("universal_node_sdk.py")
        target_sdk = output_path / "flow_sdk.py"
        
        if source_sdk.exists():
            shutil.copy2(source_sdk, target_sdk)
            print("📦 复制通用SDK完成")
        else:
            print("❌ 错误: 未找到universal_node_sdk.py")
            raise FileNotFoundError("universal_node_sdk.py not found")
            
    def _generate_pure_executor(self, output_path: Path):
        """生成纯编程流程执行器"""
        print("🚀 生成纯编程流程执行器...")
        
        # 生成所有流程函数
        flow_functions = []
        
        # 先生成子流程函数
        for flow_id, flow in self.all_flows.items():
            if flow_id != 'main':
                func_code = self._generate_pure_flow_function(flow_id, flow)
                flow_functions.append(func_code)
                
        # 最后生成主流程函数
        if 'main' in self.all_flows:
            main_func = self._generate_pure_flow_function('main', self.all_flows['main'])
            flow_functions.append(main_func)
            
        # 构建完整代码
        executor_code = self._build_pure_executor_code(flow_functions)
        
        with open(output_path / "flow_executor.py", 'w', encoding='utf-8') as f:
            f.write(executor_code)
            
        print(f"🚀 生成了 {len(flow_functions)} 个纯编程流程函数")
        
    def _generate_pure_flow_function(self, flow_id: str, flow: Dict[str, Any]) -> str:
        """生成单个纯编程流程函数"""
        nodes = flow.get('nodes', [])
        edges = flow.get('edges', [])
        flow_name = flow.get('name', flow_id)
        
        # 分析依赖并排序
        dependencies = self._analyze_dependencies(flow)
        sorted_nodes = self._topological_sort(nodes, dependencies)
        
        # 生成执行逻辑
        execution_code = []
        
        for node in sorted_nodes:
            node_id = node['id']
            node_type = node['type']
            config = node.get('config', {})
            name = config.get('name', node_id)
            description = config.get('description', '')
            
            # 获取输入映射
            input_mapping = {}
            for edge in edges:
                if edge['target']['node'] == node_id:
                    source_node = edge['source']['node']
                    target_key = edge['target']['key']
                    input_mapping[target_key] = f"result_{source_node}"
                    
            # 生成注释
            comment = f"# {name}"
            if description:
                comment += f" - {description}"
            execution_code.append(f"        {comment}")
            
            # 生成函数调用
            if node_type == 'start':
                execution_code.append(f"        result_{node_id} = input_data")
                
            elif node_type == 'text':
                text_content = config.get('text', '').replace('"', '\\"')
                execution_code.append(f'        result_{node_id} = "{text_content}"')
                
            elif node_type.startswith('flow_'):
                # 子流程调用
                subflow_name = node_type
                if input_mapping:
                    first_input = list(input_mapping.values())[0]
                    execution_code.append(f"        result_{node_id} = await {subflow_name}({first_input})")
                else:
                    execution_code.append(f"        result_{node_id} = await {subflow_name}(input_data)")
                    
            elif node_type == 'llm':
                system_prompt = config.get('systemPrompt', '').replace('"', '\\"')
                model = config.get('model', 'gpt-3.5-turbo')
                prompt_var = input_mapping.get('prompt', 'input_data')
                
                execution_code.append(f'''        result_{node_id} = await llm_call(
            model="{model}",
            system_prompt="""{system_prompt}""",
            user_prompt={prompt_var}
        )''')
        
            elif node_type == 'python':
                code = config.get('code', '')
                params = config.get('params', [])
                
                # 直接内联Python代码
                self._generate_python_inline_code(node_id, code, params, input_mapping, execution_code)
        
            elif node_type == 'javascript':
                code = config.get('code', '')
                params = config.get('params', [])
                
                # 处理JavaScript代码，修复async/await问题
                self._generate_javascript_code(node_id, code, params, input_mapping, execution_code)
        
            elif node_type == 'image':
                src_var = input_mapping.get('src', 'input_data')
                execution_code.append(f'''        result_{node_id} = await save_image(
            src={src_var},
            node_id="{node_id}"
        )
        print(f"[{name}] 图像已保存: {{result_{node_id}}}")''')
                
            elif node_type == 'display':
                input_var = list(input_mapping.values())[0] if input_mapping else 'input_data'
                execution_code.append(f'''        result_{node_id} = {input_var}
        print(f"[{name}] 显示: {{result_{node_id}}}")''')
                
            elif node_type == 'branch':
                code = config.get('code', '').replace('"""', '\\"\\"\\"')
                branches = config.get('branches', [])
                input_var = list(input_mapping.values())[0] if input_mapping else 'input_data'
                
                # 构建分支变量映射
                branch_assignments = []
                for branch in branches:
                    branch_assignments.append(f'const {branch["name"]} = "{branch["id"]}";')
                
                full_code = f'''const input = arguments[0];
{chr(10).join(branch_assignments)}

{code}'''
                
                execution_code.append(f'''        result_{node_id} = await execute_javascript_code(
            code="""{full_code}""",
            params={{"input": {input_var}}}
        )''')
                
            elif node_type == 'end':
                input_var = list(input_mapping.values())[0] if input_mapping else 'input_data'
                execution_code.append(f"        result_{node_id} = {input_var}")
                
            else:
                # 通用节点处理
                input_var = list(input_mapping.values())[0] if input_mapping else 'input_data'
                execution_code.append(f"        result_{node_id} = {input_var}  # 未知节点类型: {node_type}")
                
            execution_code.append("")  # 添加空行分隔
                
        # 找到结束节点
        end_node = next((n for n in sorted_nodes if n['type'] == 'end'), None)
        result_var = f"result_{end_node['id']}" if end_node else "None"
        
        # 构建完整函数
        if flow_id == 'main':
            return f'''
async def execute_flow(input_data=None):
    """执行主流程: {flow_name}"""
    try:
        print(f"🚀 开始执行主流程: {flow_name}")
        
{chr(10).join(execution_code)}
        print(f"✅ 主流程执行完成!")
        return {result_var}
        
    except Exception as e:
        print(f"❌ 主流程执行失败: {{str(e)}}")
        raise
'''
        else:
            return f'''
async def {flow_id}(input_data=None):
    """子流程: {flow_name}"""
    try:
        print(f"🔄 执行子流程: {flow_name}")
        
{chr(10).join(execution_code)}
        print(f"✅ 子流程 {flow_name} 完成")
        return {result_var}
        
    except Exception as e:
        print(f"❌ 子流程 {flow_name} 失败: {{str(e)}}")
        raise
'''
        
    def _build_pure_executor_code(self, flow_functions: List[str]) -> str:
        """构建纯编程执行器代码"""
        functions_str = "\n".join(flow_functions)
        
        # 统计信息
        node_types = set()
        total_nodes = 0
        for flow in self.all_flows.values():
            for node in flow.get('nodes', []):
                node_types.add(node['type'])
                total_nodes += 1
                
        return f'''#!/usr/bin/env python3
"""
Flow流程执行器 v5 - 纯编程模式
完全消除节点和边的概念，生成纯粹的Python函数调用代码

生成信息:
- 总流程数: {len(self.all_flows)}
- 总节点数: {total_nodes}
- 节点类型: {', '.join(sorted(node_types))}
"""

import asyncio
import sys
from pathlib import Path

# 添加当前目录到Python路径
sys.path.insert(0, str(Path(__file__).parent))

# 导入SDK函数
from flow_sdk import (
    llm_call, execute_python_code, execute_javascript_code, 
    save_image, log_node_execution, validate_node_config
)

{functions_str}

if __name__ == "__main__":
    async def main():
        try:
            result = await execute_flow("Hello World")
            print(f"\\n🎉 流程执行结果: {{result}}")
        except Exception as e:
            print(f"\\n💥 执行失败: {{e}}")
            import traceback
            traceback.print_exc()
            sys.exit(1)
            
    asyncio.run(main())
'''
        
    def _analyze_dependencies(self, flow: Dict[str, Any]) -> Dict[str, List[str]]:
        """分析节点依赖关系"""
        nodes = flow.get('nodes', [])
        edges = flow.get('edges', [])
        
        dependencies = {}
        
        for node in nodes:
            dependencies[node['id']] = []
            
        for edge in edges:
            target_node = edge['target']['node']
            source_node = edge['source']['node']
            dependencies[target_node].append(source_node)
            
        return dependencies
        
    def _topological_sort(self, nodes: List[Dict[str, Any]], dependencies: Dict[str, List[str]]) -> List[Dict[str, Any]]:
        """拓扑排序节点"""
        result = []
        visited = set()
        temp_visited = set()
        
        def visit(node_id: str):
            if node_id in temp_visited:
                raise ValueError(f"检测到循环依赖: {node_id}")
            if node_id in visited:
                return
                
            temp_visited.add(node_id)
            
            for dep in dependencies.get(node_id, []):
                visit(dep)
                
            temp_visited.remove(node_id)
            visited.add(node_id)
            
            node = next((n for n in nodes if n['id'] == node_id), None)
            if node:
                result.append(node)
                
        for node in nodes:
            if node['id'] not in visited:
                visit(node['id'])
                
        return result
        
    def _generate_python_inline_code(self, node_id: str, code: str, params: List[Dict], input_mapping: Dict[str, str], execution_code: List[str]):
        """生成内联Python代码"""
        # 清理和处理代码
        clean_code = code.strip()
        
        # 如果代码有def main格式，提取主体
        if clean_code.startswith('def main('):
            lines = clean_code.split('\n')
            if len(lines) > 1:
                # 移除第一行def main定义
                body_lines = []
                for line in lines[1:]:
                    if line.strip() == '':
                        body_lines.append('')
                    elif line.startswith('    '):
                        # 移除4个空格的缩进
                        body_lines.append(line[4:])
                    else:
                        body_lines.append(line)
                clean_code = '\n'.join(body_lines)
        
        # 构建参数赋值
        param_assignments = []
        for param in params:
            param_name = param['name']
            if param_name in input_mapping:
                param_assignments.append(f"        {param_name} = {input_mapping[param_name]}")
            else:
                param_assignments.append(f"        {param_name} = None")
        
        if param_assignments:
            execution_code.extend(param_assignments)
        
        # 处理返回值
        if 'return ' in clean_code:
            # 代码中有return语句，需要包装成函数来捕获返回值
            param_names = [p['name'] for p in params]
            
            # 正确缩进代码主体 - 为函数体额外增加4个空格
            indented_code = '\n'.join(['            ' + line if line.strip() else '' for line in clean_code.split('\n')])
            
            func_code = f'''        def _inline_func({', '.join(param_names)}):
{indented_code}
        
        result_{node_id} = _inline_func({', '.join([p['name'] for p in params])})'''
            execution_code.append(func_code)
        else:
            # 没有return语句，直接执行代码
            indented_code = '\n'.join(['        ' + line if line.strip() else '' for line in clean_code.split('\n')])
            execution_code.append(indented_code)
            # 尝试从最后一行获取结果
            lines = clean_code.strip().split('\n')
            if lines:
                last_line = lines[-1].strip()
                if last_line and not any(last_line.startswith(kw) for kw in ['print(', 'plt.', 'import ', 'from ', 'if ', 'for ', 'while ', 'def ', 'class ', 'try:', 'except', 'with ']):
                    # 假设最后一行是结果变量
                    execution_code.append(f"        result_{node_id} = {last_line}")
                else:
                    execution_code.append(f"        result_{node_id} = None")
            else:
                execution_code.append(f"        result_{node_id} = None")
    
    def _generate_javascript_code(self, node_id: str, code: str, params: List[Dict], input_mapping: Dict[str, str], execution_code: List[str]):
        """生成JavaScript代码，修复async/await问题"""
        # 处理async/await语法 - 确保代码在async函数中
        if 'await ' in code and not code.strip().startswith('(async'):
            # 包装成立即执行的async函数
            wrapped_code = f"(async () => {{\n{code}\n}})()"
        else:
            wrapped_code = code
        
        # 构建参数字典
        param_assignments = []
        for param in params:
            param_name = param['name']
            if param_name in input_mapping:
                param_assignments.append(f'"{param_name}": {input_mapping[param_name]}')
        
        param_dict = "{" + ", ".join(param_assignments) + "}" if param_assignments else "{}"
        
        # 对于包含模板字符串的代码，使用raw字符串避免转义问题
        execution_code.append(f'''        result_{node_id} = await execute_javascript_code(
            code=r"""{wrapped_code}""",
            params={param_dict}
        )''')
        
    def _generate_requirements(self, output_path: Path):
        """生成依赖文件"""
        requirements = [
            "aiohttp>=3.8.0",
            "aiofiles>=0.8.0", 
            "openai>=1.0.0",
            "requests>=2.25.0",
            "matplotlib>=3.5.0"
        ]
        
        with open(output_path / "requirements.txt", 'w', encoding='utf-8') as f:
            f.write("\n".join(requirements))
            
    def _generate_readme(self, output_path: Path):
        """生成使用说明"""
        node_types = set()
        total_nodes = 0
        
        for flow in self.all_flows.values():
            for node in flow.get('nodes', []):
                node_types.add(node['type'])
                total_nodes += 1
                
        readme_content = f'''# Flow执行器 v5 - 纯编程模式

这是由Flow DSL转换器v5自动生成的**纯Python代码**，完全消除了节点和边的概念。

## 📊 转换统计

- **总流程数**: {len(self.all_flows)}
- **子流程数**: {len(self.all_flows) - 1}
- **总节点数**: {total_nodes}
- **使用的节点类型**: {', '.join(sorted(node_types))}

## 🏗️ 纯编程架构

### 设计理念

1. **完全消除节点概念** - 生成的代码就像手写的Python函数调用
2. **内联配置参数** - 所有配置直接写在函数调用中
3. **注释化描述** - name和description变成代码注释
4. **纯函数式** - 没有配置文件，没有节点映射

### 文件说明

- `flow_sdk.py` - **基础SDK函数**，提供llm_call、execute_python_code等工具函数
- `flow_executor.py` - **纯编程流程执行器**，包含完整的流程逻辑
- `requirements.txt` - Python依赖包列表
- `README.md` - 本说明文件

## 🚀 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 环境变量配置

```bash
export OPENAI_API_KEY="your-api-key"
export OPENAI_API_BASE_URL="https://api.openai.com/v1"  # 可选
```

### 3. 运行流程

```bash
python flow_executor.py
```

### 4. 在代码中调用

```python
import asyncio
from flow_executor import execute_flow

async def main():
    result = await execute_flow("你的输入数据")
    print(f"执行结果: {{result}}")

asyncio.run(main())
```

## 💡 代码示例

生成的代码完全像手写的Python：

```python
# 生成搜索关键词 - 根据研究主题生成一组搜索关键词
result_llmKeywords = await llm_call(
    model="DeepSeek-V3",
    system_prompt="请根据以下研究主题，生成一个覆盖面广且精准的搜索关键词列表...",
    user_prompt=result_start
)

# 搜索信息 - 对每个关键词执行网络检索
result_jsSearch = await execute_javascript_code(
    code=\"\"\"
    const results = [];
    for (const keyword of JSON.parse(keywords)) {{
        // 执行搜索逻辑
    }}
    return results;
    \"\"\",
    params={{"keywords": result_llmKeywords}}
)
```

## ⚠️ 注意事项

1. 此代码完全是标准Python，可以像普通Python项目一样维护
2. 所有配置都内联在代码中，修改直接编辑flow_executor.py
3. 没有节点概念，只有函数调用和数据流
4. 所有函数都是异步的，需要使用`await`调用

如有问题，请检查代码逻辑或联系开发人员。
'''
        
        with open(output_path / "README.md", 'w', encoding='utf-8') as f:
            f.write(readme_content)


def main():
    """主函数"""
    import sys
    
    if len(sys.argv) < 2:
        print("用法: python transform_v5.py <flow.json> [output_dir]")
        print("示例: python transform_v5.py test_branch_flow.json output_v5")
        sys.exit(1)
        
    flow_file = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "output"
    
    if not os.path.exists(flow_file):
        print(f"❌ 错误: 文件 {flow_file} 不存在")
        sys.exit(1)
        
    transformer = FlowTransformerV5()
    try:
        transformer.transform_flow(flow_file, output_dir)
        print(f"\n🎉 转换成功完成！")
        print(f"📁 输出目录: ./{output_dir}/")
        print(f"🚀 运行: cd {output_dir} && python flow_executor.py")
        print(f"📝 生成的代码完全是标准Python，没有节点概念!")
    except Exception as e:
        print(f"❌ 转换失败: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main() 