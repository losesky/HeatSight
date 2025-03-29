import nltk
import ssl
import os
from pathlib import Path
import sys

def setup_ssl_context():
    """配置SSL上下文"""
    try:
        _create_unverified_https_context = ssl._create_unverified_context
    except AttributeError:
        pass
    else:
        ssl._create_default_https_context = _create_unverified_https_context

def download_nltk_resource(resource, download_dir):
    """下载单个NLTK资源"""
    max_retries = 3
    for attempt in range(max_retries):
        try:
            print(f"正在下载 {resource} (尝试 {attempt + 1}/{max_retries})...")
            nltk.download(resource, download_dir=download_dir, quiet=False)
            return True
        except Exception as e:
            print(f"下载 {resource} 失败: {e}")
            if attempt < max_retries - 1:
                print("正在重试...")
            else:
                print(f"无法下载 {resource}，已达到最大重试次数")
                return False

def verify_resource(resource, nltk_data_dir):
    """验证NLTK资源是否可用"""
    try:
        # 根据资源类型选择正确的验证方法
        if resource == 'punkt':
            # 检查punkt数据文件是否存在
            punkt_path = Path(nltk_data_dir) / "tokenizers" / "punkt"
            if not punkt_path.exists():
                return False
            # 尝试使用punkt进行分词
            try:
                from nltk.tokenize import PunktSentenceTokenizer
                tokenizer = PunktSentenceTokenizer()
                test_text = "This is a test sentence. This is another sentence."
                sentences = tokenizer.tokenize(test_text)
                return len(sentences) > 1
            except Exception as e:
                print(f"Punkt分词测试失败: {e}")
                return False
        elif resource == 'stopwords':
            # 尝试加载停用词
            try:
                stopwords = nltk.corpus.stopwords.words('english')
                return len(stopwords) > 0
            except LookupError:
                return False
        return False
    except Exception as e:
        print(f"验证 {resource} 时出错: {str(e)}")
        return False

def main():
    """主函数"""
    # 配置SSL
    setup_ssl_context()
    
    # 设置NLTK数据目录
    nltk_data_dir = Path(__file__).parent / "nltk_data"
    os.environ['NLTK_DATA'] = str(nltk_data_dir)
    nltk_data_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"NLTK数据将被下载到: {nltk_data_dir}")
    
    # 清理旧的下载（如果存在）
    import shutil
    if nltk_data_dir.exists():
        print("清理旧的NLTK数据...")
        shutil.rmtree(nltk_data_dir)
        nltk_data_dir.mkdir(parents=True)
    
    # 只下载分词所需的基本资源
    resources = [
        'punkt',
        'stopwords'
    ]
    
    # 下载资源
    failed_resources = []
    for resource in resources:
        if not download_nltk_resource(resource, str(nltk_data_dir)):
            failed_resources.append(resource)
    
    # 验证下载
    print("\n验证NLTK资源:")
    verification_failed = []
    for resource in resources:
        if verify_resource(resource, nltk_data_dir):
            print(f"✓ {resource} 已成功安装并可用")
        else:
            print(f"✗ {resource} 安装失败或不可用")
            verification_failed.append(resource)
    
    # 报告结果
    if not verification_failed:
        print("\n✨ 所有NLTK资源已成功安装！")
        return 0
    else:
        print("\n⚠️ 以下资源安装失败或不可用:")
        for resource in verification_failed:
            print(f"  - {resource}")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 