"""Offline source snapshot guard. Run from any directory; no network or uploads."""
from pathlib import Path
import hashlib,json,re,sys
root=Path(__file__).resolve().parents[1]
errors=[];count=0
blocked_suffix={'.sqlite','.db','.pem','.key','.mp4','.mov','.xlsx','.jpg','.jpeg','.png','.webp'}
secret_patterns=[r'gh[pousr]_[A-Za-z0-9]{30,}',r'github_pat_[A-Za-z0-9_]{40,}',r'sk-proj-[A-Za-z0-9_-]{25,}',r'xox[baprs]-[A-Za-z0-9-]{20,}',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----']
for p in root.rglob('*'):
 if not p.is_file() or '.git' in p.relative_to(root).parts:continue
 rel=p.relative_to(root).as_posix();count+=1
 if any(x in p.relative_to(root).parts for x in ['node_modules','.wrangler','.sites-runtime','__pycache__']):errors.append(rel+': runtime/cache')
 if p.name.startswith('.env') and p.name!='.env.example':errors.append(rel+': env')
 if p.name.startswith('.dev.vars') or p.suffix.lower() in blocked_suffix:errors.append(rel+': excluded file type')
 if p.suffix=='.json':
  try:json.loads(p.read_text())
  except Exception:errors.append(rel+': invalid JSON')
 try:t=p.read_text()
 except UnicodeDecodeError:continue
 for pattern in secret_patterns:
  if re.search(pattern,t):errors.append(rel+': possible secret')
reg=json.loads((root/'SITES.json').read_text())
for project in reg['projects']:
 path=project.get('path')
 if path and not (root/path/'README.md').is_file():errors.append(path+': missing README')
manifest=root/'SHA256SUMS'
if manifest.exists():
 expected={}
 for line in manifest.read_text().splitlines():
  digest,name=line.split('  ',1);expected[name]=digest
 actual={p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in root.rglob('*') if p.is_file() and '.git' not in p.relative_to(root).parts and p.name!='SHA256SUMS'}
 if expected!=actual:errors.append('SHA256SUMS differs from current files; regenerate after intentional edits')
print(json.dumps({'files_checked':count,'errors':errors},ensure_ascii=False))
sys.exit(bool(errors))
