"""
快速验证脚本：测试重新训练后的Stage A模型
"""

import sys
import os
from pathlib import Path
import joblib
import json

# 设置输出编码（Windows控制台兼容）
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# 导入app.py中的函数
sys.path.insert(0, str(Path(__file__).parent))
from app import predict_two_stage

def main():
    """主函数"""
    print("=" * 60)
    print("Stage A模型快速验证")
    print("=" * 60)
    
    # 测试用例
    test_cases = [
        ("hello hello, nice to meet you", "噪声/闲聊"),
        ("TODAY IS A GOOD DAY XSS", "关键词仅（无上下文）"),
        ("Fix: Prevent command injection by sanitizing user input. Added input validation to block malicious payloads.", "补丁/缓解风格"),
        ("The application fails to properly validate user input in the login form, which may cause unexpected behavior.", "正常GitHub工程问题"),
        ("CVE-2024-1234: SQL injection vulnerability in the login form allows remote attackers to execute arbitrary SQL commands via the username parameter. This affects version 2.5.0 and earlier.", "CVE漏洞描述"),
    ]
    
    print("\n测试用例:")
    for i, (text, desc) in enumerate(test_cases, 1):
        print(f"\n{i}. {desc}")
        print(f"   输入: {text[:80]}...")
        
        try:
            result = predict_two_stage(text)
            
            print(f"   结果:")
            print(f"     applicable: {result.get('applicable', 'N/A')}")
            print(f"     pApplicable: {result.get('pApplicable', 'N/A'):.4f}" if result.get('pApplicable') is not None else "     pApplicable: N/A")
            print(f"     reliability: {result.get('reliability', 'N/A')}")
            
            if result.get('notes'):
                print(f"     notes: {result.get('notes', [])}")
            
            # 验证预期
            if i == 1:  # 噪声
                expected = not result.get('applicable', True)
                status = "[PASS]" if expected else "[FAIL]"
                print(f"     {status} 预期: not applicable")
            elif i == 2:  # 关键词仅
                expected = not result.get('applicable', True) or result.get('pApplicable', 1.0) < 0.5
                status = "[PASS]" if expected else "[FAIL]"
                print(f"     {status} 预期: not applicable 或低概率")
            elif i == 3:  # 补丁/缓解
                expected = not result.get('applicable', True) or result.get('reliability', 'High') == 'Low'
                status = "[PASS]" if expected else "[FAIL]"
                print(f"     {status} 预期: not applicable 或可靠性降级")
            elif i == 4:  # 正常GitHub问题
                # 可能applicable也可能not，取决于内容
                print(f"     [INFO] 预期: 取决于内容（可能not applicable）")
            elif i == 5:  # CVE
                expected = result.get('applicable', False)
                status = "[PASS]" if expected else "[FAIL]"
                print(f"     {status} 预期: applicable")
        
        except Exception as e:
            print(f"     [ERROR] 错误: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("验证完成")
    print("=" * 60)


if __name__ == '__main__':
    main()

