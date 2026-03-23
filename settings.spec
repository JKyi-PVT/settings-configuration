# settings.spec
# PyInstaller spec file for Prime Vision Technology Settings/Configuration UI
# Run with: pyinstaller settings.spec

import os

block_cipher = None

a = Analysis(
    ['backend.py'],
    pathex=[],
    binaries=[],
    # Bundle the built React frontend static files into the exe
    datas=[
        (os.path.join('frontend', 'dist'), os.path.join('frontend', 'dist')),
    ],
    hiddenimports=[
        # Paramiko and its cryptography dependencies are often missed by PyInstaller
        'paramiko',
        'paramiko.transport',
        'cryptography',
        'cryptography.hazmat.backends.openssl',
        'cryptography.hazmat.primitives.asymmetric.padding',
        # ruamel.yaml dynamic imports
        'ruamel.yaml',
        'ruamel.yaml.comments',
        'ruamel.yaml.constructor',
        'ruamel.yaml.representer',
        'ruamel.yaml.resolver',
        # uvicorn and its dependencies
        'uvicorn',
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        # FastAPI / starlette internals
        'starlette.routing',
        'starlette.staticfiles',
        'anyio',
        'anyio._backends._asyncio',
        # requests dependencies
        'requests',
        'charset_normalizer',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclude the old Streamlit stack — not needed in the exe
        'streamlit',
        'tornado',
        'altair',
        'pyarrow',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='PVT-Settings',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    # console=True shows a terminal window alongside the app which is useful
    # for seeing server logs. Set to False to hide it once the app is stable.
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
