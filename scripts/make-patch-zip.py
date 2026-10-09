"""Builds a patch .zip that extracts correctly on Linux.

Windows PowerShell 5's Compress-Archive writes backslash path separators, which Linux tools
extract as literal file names ("backend\\dist\\src\\index.js") instead of folders. This writes
forward-slash paths and marks *.sh executable.

Usage: python scripts/make-patch-zip.py patches/<patch-folder> [out.zip]
"""
import os
import sys
import zipfile

src = sys.argv[1].rstrip('/\\')
out = sys.argv[2] if len(sys.argv) > 2 else src + '.zip'

count = 0
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for folder, _, files in os.walk(src):
        for name in sorted(files):
            path = os.path.join(folder, name)
            arc = os.path.relpath(path, src).replace(os.sep, '/')
            info = zipfile.ZipInfo.from_file(path, arc)
            mode = 0o755 if name.endswith('.sh') else 0o644
            info.external_attr = (0o100000 | mode) << 16  # regular file + unix permissions
            info.create_system = 3  # unix, so permissions are honoured by unzip
            info.compress_type = zipfile.ZIP_DEFLATED
            with open(path, 'rb') as f:
                z.writestr(info, f.read())
            count += 1

with zipfile.ZipFile(out) as z:
    bad = [i.filename for i in z.infolist() if '\\' in i.filename]
assert not bad, f'backslash paths: {bad[:3]}'
print(f'{out}: {count} files, forward-slash paths, *.sh executable')
