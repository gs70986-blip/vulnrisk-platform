"""
快速验证门控机制的测试脚本
用于验证通用、内容无关的证据充分性检查
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app import extract_evidence, check_input_quality, assess_prediction_uncertainty

def test_evidence_extraction():
    """测试证据提取"""
    print("=" * 60)
    print("测试1: 证据提取")
    print("=" * 60)
    
    test_cases = [
        ("TODAY IS A GOOD DAY XSS", "today is a good day xss"),
        ("XSS vulnerability in login form allows attacker to execute arbitrary JavaScript", "xss vulnerability in login form allows attacker to execute arbitrary javascript"),
        ("Fix: Prevent command injection by sanitizing user input", "fix prevent command injection by sanitizing user input"),
        ("CVE-2024-1234: SQL injection in version 2.5.0 allows remote code execution", "cve 2024 1234 sql injection in version 2 5 0 allows remote code execution"),
    ]
    
    for original, processed in test_cases:
        sec_count, ctx_count, tech_count = extract_evidence(original, processed)
        print(f"\n输入: {original[:50]}...")
        print(f"  安全关键词: {sec_count}, 上下文线索: {ctx_count}, 技术证据: {tech_count}")
        print(f"  总证据: {ctx_count + tech_count}")


def test_input_quality():
    """测试输入质量检查"""
    print("\n" + "=" * 60)
    print("测试2: 输入质量检查")
    print("=" * 60)
    
    test_cases = [
        ("hello hello, nice to meet you", "hello hello nice to meet you"),
        ("TODAY IS A GOOD DAY XSS", "today is a good day xss"),
        ("XSS", "xss"),
        ("Fix: Prevent command injection by sanitizing user input", "fix prevent command injection by sanitizing user input"),
        ("CVE-2024-1234: SQL injection in version 2.5.0 allows remote code execution", "cve 2024 1234 sql injection in version 2 5 0 allows remote code execution"),
        ("Cross-Site Scripting (XSS) vulnerability in the login form. User input is directly rendered in HTML without escaping.", "cross site scripting xss vulnerability in the login form user input is directly rendered in html without escaping"),
    ]
    
    for original, processed in test_cases:
        is_low, reason, note = check_input_quality(original, processed)
        print(f"\n输入: {original[:60]}...")
        print(f"  低质量: {is_low}, 原因: {reason}")
        if note:
            print(f"  说明: {note[:80]}...")


def test_uncertainty():
    """测试不确定性评估"""
    print("\n" + "=" * 60)
    print("测试3: 不确定性评估")
    print("=" * 60)
    
    test_cases = [
        ([0.25, 0.25, 0.25, 0.25], "均匀分布"),
        ([0.3, 0.28, 0.22, 0.20], "top-1和top-2接近"),
        ([0.5, 0.3, 0.15, 0.05], "有明显优势"),
        ([0.35, 0.33, 0.20, 0.12], "top-1和top-2接近"),
    ]
    
    for probs, desc in test_cases:
        is_uncertain, level, reason = assess_prediction_uncertainty(probs)
        print(f"\n概率分布: {probs} ({desc})")
        print(f"  不确定: {is_uncertain}, 级别: {level:.3f}")
        if reason:
            print(f"  原因: {reason}")


if __name__ == '__main__':
    test_evidence_extraction()
    test_input_quality()
    test_uncertainty()
    print("\n" + "=" * 60)
    print("测试完成")
    print("=" * 60)


