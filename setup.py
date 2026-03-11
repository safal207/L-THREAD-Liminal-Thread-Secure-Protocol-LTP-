from setuptools import find_packages, setup

setup(
    name="ltp",
    version="0.1.0",
    description="Liminal Thread Protocol inspector CLI",
    packages=find_packages(include=["ltp", "ltp.*"]),
    include_package_data=True,
    install_requires=[],
    entry_points={"console_scripts": ["ltp=ltp.cli:main"]},
)
