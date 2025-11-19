from setuptools import setup, find_packages

setup(
    name="ltp-client",
    version="0.6.0-alpha.3",
    description="LTP (Liminal Thread Protocol) client SDK for Python",
    author="LIMINAL Team",
    packages=find_packages(),
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
)

