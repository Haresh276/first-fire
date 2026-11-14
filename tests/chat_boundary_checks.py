"""Black-box loopback API misuse checks. No access to real secrets and no external HTTP."""
import argparse, http.client, json
from urllib.parse import urlsplit

def run(port):
    cases=[
      ('blank',{'message':'   '},400,{}),
      ('oversized prompt',{'message':'X'*2001},400,{}),
      ('additional system role',{'message':'Hello','history':[{'role':'system','content':'invent'}]},400,{}),
      ('too many historical turns',{'message':'hello','history':[{'role':'user','content':'x'}]*13},400,{}),
      ('wrong history type',{'message':'hello','history':{}},400,{}),
      ('wrong content type',{'message':'hi'},415,{'Content-Type':'text/plain'}),
      ('foreign browser origin',{'message':'hi'},403,{'Origin':'https://example.invalid'}),
      ('foreign Host',{'message':'hi'},403,{'Host':'untrusted.invalid'}),
      ('oversized request body',{'message':'x'*241000},413,{}),
      ('no valid JSON','{',400,{})]
    def call(path,body,headers):
        c=http.client.HTTPConnection('127.0.0.1',port,timeout=8)
        try:
            c.request('POST',path,body=body,headers={'Content-Type':'application/json',**headers})
            res=c.getresponse();return res.status,res.read()
        finally:c.close()
    for label,value,status,headers in cases:
        raw=value if isinstance(value,str) else json.dumps(value)
        code,_=call('/api/chat',raw.encode(),headers);assert code==status,(label,code,status);print('PASS:',label)
    code,_=call('/api/other',b'{}',{});assert code==404
    # Simple server responds with a deny or not-found instead of exposing the nonpublic model and test files.
    for path in ('/../chat/engine.py','/tests/chat/questions.json','/.chat-venv/','/research/evaluation-examples/key.example.json'):
        c=http.client.HTTPConnection('127.0.0.1',port,timeout=8);c.request('GET',path)
        response=c.getresponse();response.read();assert response.status in (403,404),(path,response.status);c.close()
    print('PASS: unknown API route and private-file paths')
if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--port',type=int,default=8765);run(ap.parse_args().port)
