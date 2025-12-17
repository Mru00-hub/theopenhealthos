import sys
import urllib.request

try:
    response = urllib.request.urlopen('http://localhost:5000/health', timeout=2)
    if response.status == 200:
        sys.exit(0)
    else:
        sys.exit(1)
except:
    sys.exit(1)
