"""Validate monthly diplomacy against its visible ledger, including spy penalties."""
import re


def relation_snapshot(texts, country):
    header = next((t for t in texts if t.startswith(country + ' · отношения ')), None)
    assert header is not None, 'Missing target relation header'
    match = re.fullmatch(re.escape(country) + r' · отношения (-?\d+) · доверие \d+ · МИР', header)
    assert match, 'Invalid relation header or unexpected war'
    relation = int(match.group(1))
    assert -100 <= relation <= 100, 'Invalid relation value'
    tick_text = next((t for t in texts if t.startswith('Ход ')), '')
    tick_match = re.match(r'Ход (\d+) · ', tick_text)
    assert tick_match, 'Missing campaign clock'
    start = texts.index(header)
    assert 'Дипломатические миссии' in texts[start + 1:], 'Incomplete relation ledger capture'
    end = texts.index('Дипломатические миссии', start + 1)
    reasons = {}
    for text in texts[start + 1:end]:
        if text.startswith(('Договоры: ', 'Гарантии: ')):
            continue
        reason = re.fullmatch(r'(.+): ([+-]\d+)', text)
        assert reason, 'Unreadable relation reason: ' + text
        label, value = reason.group(1), int(reason.group(2))
        assert -100 <= value <= 100, 'Invalid relation reason value'
        # Two countries can run separate improving missions with the same label.
        reasons[label] = reasons.get(label, 0) + value
    return {'tick': int(tick_match.group(1)), 'relation': relation, 'reasons': reasons}


def assert_relation_mission(before, after, progress_text, minimum_months):
    progress = re.fullmatch(r'Улучшение отношений: (\d+)/12 мес\. · 3 млн / мес\.', progress_text)
    assert progress, 'Missing active paid diplomatic mission'
    months = int(progress.group(1))
    assert minimum_months <= months < 12, 'Diplomatic mission did not advance enough active months'
    assert after['tick'] - before['tick'] == months, 'Mission progress differs from the real campaign clock'
    label = 'Дипломатическое сотрудничество'
    reward = after['reasons'].get(label, 0) - before['reasons'].get(label, 0)
    assert reward >= 3 * months, 'Diplomatic mission missed its monthly relation reward'
    # Infer the unchanged baseline from the unsaturated initial ledger. Every
    # later contextual, diplomatic and detected-spy effect must explain the net
    # value. A successful mission need not increase the net value by its reward.
    assert -100 < before['relation'] < 100, 'Initial relation is saturated; baseline cannot be verified'
    baseline = before['relation'] - sum(before['reasons'].values())
    expected = max(-100, min(100, baseline + sum(after['reasons'].values())))
    assert after['relation'] == expected, 'Relation total differs from its actual reason ledger'
    return {'months': months, 'missionReward': reward, 'relationBefore': before['relation'],
            'relationAfter': after['relation'], 'reasonsBefore': before['reasons'], 'reasonsAfter': after['reasons']}
