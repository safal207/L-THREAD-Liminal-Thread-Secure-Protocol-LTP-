from pathlib import Path

from setuptools import find_packages, setup

ROOT = Path(__file__).parent

setup(
    name="ltp-client",
    version="0.6.0-alpha.3",
    description="LTP (Liminal Thread Protocol) client SDK for Python",
    long_description=(ROOT / "README.md").read_text(encoding="utf-8"),
    long_description_content_type="text/markdown",
    author="LIMINAL Team",
    url="https://github.com/safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-",
    license="MIT",
    packages=find_packages(exclude=("tests", "tests.*")),
    install_requires=[
        "websockets>=11.0",
        "cryptography>=41.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0",
            "pytest-asyncio>=0.21",
        ],
    },
    python_requires=">=3.9",
    classifiers=[
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3 :: Only",
    ],
)
