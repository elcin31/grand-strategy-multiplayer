"""Select the newest durable QA generation, including equal-calendar saves."""
import json
from pathlib import Path
import re

def latest_war_state(directory):
    generations={}
    for file in Path(directory).rglob('camera23-war.*.json'):
        match=re.fullmatch(r'camera23-war\.(\d+)\.json',file.name)
        if not match:continue
        generation=int(match[1]);assert generation>0
        record=json.loads(file.read_text())
        state=record.get('state')
        if not state:continue
        if generation in generations:
            assert generations[generation]==state,'Conflicting copies of one durable save generation'
        generations[generation]=state
    assert generations,'No completed campaign generation was copied'
    return generations[max(generations)]
