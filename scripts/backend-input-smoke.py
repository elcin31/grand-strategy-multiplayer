"""Bounded hostile requests against only the dedicated backend; creates no rooms."""
import json,urllib.request,urllib.error
BASE='https://dfjsnjxnyjspwugjguhq.supabase.co/functions/v1/'
count=0
for endpoint in ['game-room','game-command']:
    for body,expected in [(b'{',400),(b'null',400),(b'[]',400),(b'"text"',400),(b' '*32769,413)]:
        req=urllib.request.Request(BASE+endpoint,data=body,headers={'Content-Type':'application/json'},method='POST')
        try:
            with urllib.request.urlopen(req,timeout=45) as response: status=response.status
        except urllib.error.HTTPError as error: status=error.code
        assert status==expected,(endpoint,status,expected)
        count+=1
print('PASS: bounded malformed HTTP requests',count)
