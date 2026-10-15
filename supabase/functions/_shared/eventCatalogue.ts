import type {EventDefinition} from './eventTypes.ts';

/** Original Dominion stories. Data only: every effect names a registered operation. */
export const DOMINION_EVENTS:readonly EventDefinition[]=[
 {id:'debt-pressure',title:'Цена государственных обязательств',category:'Economy',illustration:'Economy',
  description:'Обслуживание долга вытесняет расходы на развитие. Казначейство предлагает выбрать путь восстановления доверия.',fromYear:1,toYear:9999,deadlineMonths:3,
  trigger:{kind:'all',conditions:[{kind:'metric',metric:'debt',op:'gte',value:1500},{kind:'metric',metric:'budgetBalance',op:'lt',value:0}]},
  fallbackChoiceId:'delay',options:[
   {id:'audit',title:'Независимая бюджетная ревизия',description:'Оплатить аудит, открыть финансовый курс и проверить результат через полгода.',cost:{treasury:60,politicalPower:10},aiPriority:80,effects:[{kind:'metric',metric:'unrest',amount:2},{kind:'unlockFocus',focusId:'event-fiscal-recovery'},{kind:'schedule',eventId:'debt-review',months:6}]},
   {id:'dialogue',title:'Согласовать общественный компромисс',description:'Направить средства на существующую программу общественных консультаций. Долг сохраняется.',aiPriority:60,effects:[{kind:'decision',decisionId:'SocialDialogue'},{kind:'schedule',eventId:'debt-review',months:6}]},
   {id:'delay',title:'Отложить решение',description:'Недовольство +2. Через полгода казначейство вернётся к вопросу.',aiPriority:10,effects:[{kind:'metric',metric:'unrest',amount:2},{kind:'schedule',eventId:'debt-review',months:6}]}
  ]},
 {id:'debt-review',title:'Итоги финансовой программы',category:'Economy',illustration:'Economy',description:'Прошло полгода. Доверие определяется реальным балансом бюджета, а не обещаниями правительства.',fromYear:1,toYear:9999,deadlineMonths:2,fallbackChoiceId:'continue',options:[
  {id:'recovered',title:'Подтвердить восстановление',description:'При неотрицательном бюджете: стабильность +3, репутация +2.',condition:{kind:'metric',metric:'budgetBalance',op:'gte',value:0},aiPriority:100,effects:[{kind:'metric',metric:'stability',amount:3},{kind:'metric',metric:'reputation',amount:2}]},
  {id:'continue',title:'Продолжить осторожный курс',description:'Политическая власть −5; финансовые обязательства сохраняются.',aiPriority:10,effects:[{kind:'metric',metric:'politicalPower',amount:-5}]}
 ]},
 {id:'border-question',title:'Незавершённый пограничный спор',category:'Diplomacy',illustration:'Diplomacy',description:'Региональные представители требуют обсудить территорию, ранее принадлежавшую нашему государству. Решение определит дальнейший дипломатический путь.',counterpart:'ClaimNeighbour',fromYear:1,toYear:9999,deadlineMonths:3,
  trigger:{kind:'all',conditions:[{kind:'war',active:false},{kind:'metric',metric:'stability',op:'gte',value:50}]},fallbackChoiceId:'defer',options:[
   {id:'talks',title:'Предложить переговоры',description:'25 млн на переговоры; отношения +8. Встреча продолжится через два месяца.',cost:{treasury:25},aiPriority:90,effects:[{kind:'relation',amount:8},{kind:'schedule',eventId:'border-talks',months:2}]},
   {id:'demand',title:'Передать дипломатическое требование',description:'Начать существующий пограничный кризис за 10 политической власти. Территория не передаётся автоматически.',aiPriority:40,effects:[{kind:'crisis'},{kind:'schedule',eventId:'border-talks',months:3}]},
   {id:'defer',title:'Сохранить нынешнее положение',description:'Стабильность +1; спор остаётся без территориальных изменений.',aiPriority:10,effects:[{kind:'metric',metric:'stability',amount:1}]}
  ]},
 {id:'border-talks',title:'Результат пограничных консультаций',category:'Diplomacy',illustration:'Diplomacy',description:'Делегации оценивают отношения и предлагают продолжить мирное сотрудничество либо сохранить разногласия.',fromYear:1,toYear:9999,deadlineMonths:2,fallbackChoiceId:'disagreement',options:[
  {id:'cooperate',title:'Принять программу сотрудничества',description:'При отношениях не ниже нуля: 40 млн, репутация +3, открывается дипломатический курс.',condition:{kind:'relation',target:'counterpart',op:'gte',value:0},cost:{treasury:40},aiPriority:100,effects:[{kind:'metric',metric:'reputation',amount:3},{kind:'unlockFocus',focusId:'event-regional-accord'}]},
  {id:'disagreement',title:'Зафиксировать разногласия',description:'Отношения −3. Вопрос войны остаётся отдельным решением по обычным правилам.',aiPriority:10,effects:[{kind:'relation',amount:-3}]}
 ]},
 {id:'modernization-mandate',title:'Мандат на модернизацию',category:'Reform',illustration:'Reform',description:'Научные учреждения предлагают связать административную реформу с развитием инфраструктуры. Программа потребует реального финансирования.',fromYear:1850,toYear:9999,deadlineMonths:4,
  trigger:{kind:'all',conditions:[{kind:'technology',id:'science-method'},{kind:'metric',metric:'stability',op:'gte',value:60},{kind:'metric',metric:'treasury',op:'gte',value:1200},{kind:'war',active:false}]},fallbackChoiceId:'gradual',options:[
   {id:'fund',title:'Профинансировать реформу',description:'120 млн и 15 политической власти; открывается курс реформ. Через восемь месяцев — оценка прогресса.',cost:{treasury:120,politicalPower:15},aiPriority:90,effects:[{kind:'unlockFocus',focusId:'event-modern-administration'},{kind:'schedule',eventId:'modernization-review',months:8}]},
   {id:'gradual',title:'Двигаться постепенно',description:'Политическая власть +5; крупных обязательств не возникает.',aiPriority:10,effects:[{kind:'metric',metric:'politicalPower',amount:5}]}
  ]},
 {id:'modernization-review',title:'Первые результаты преобразований',category:'Reform',illustration:'Reform',description:'Новые правила должны подтвердиться выполненными национальными задачами. Символического объявления недостаточно.',fromYear:1850,toYear:9999,deadlineMonths:3,fallbackChoiceId:'unfinished',options:[
  {id:'completed',title:'Представить результаты',description:'После завершения открытого курса: стабильность +3, репутация +2.',condition:{kind:'focus',id:'event-modern-administration'},aiPriority:100,effects:[{kind:'metric',metric:'stability',amount:3},{kind:'metric',metric:'reputation',amount:2}]},
  {id:'unfinished',title:'Признать незавершённость работ',description:'Недовольство +1. Текущие проекты сохраняются.',aiPriority:10,effects:[{kind:'metric',metric:'unrest',amount:1}]}
 ]},
 {id:'recovery-mandate',title:'Возвращение к мирной жизни',category:'Recovery',illustration:'Recovery',description:'Война закончилась, но повреждённые регионы требуют ремонта. Правительство выбирает способ начать восстановление.',fromYear:1,toYear:9999,deadlineMonths:3,
  trigger:{kind:'all',conditions:[{kind:'war',active:false},{kind:'recentPeace',months:12},{kind:'damaged',minimum:1}]},fallbackChoiceId:'local',options:[
   {id:'program',title:'Принять восстановительную программу',description:'Запустить существующее решение восстановления с его полной ценой; открыть послевоенный курс.',aiPriority:100,effects:[{kind:'decision',decisionId:'Reconstruction'},{kind:'unlockFocus',focusId:'event-postwar-renewal'},{kind:'schedule',eventId:'recovery-review',months:6}]},
   {id:'local',title:'Начать с местных инициатив',description:'Стабильность +1. Через полгода будет оценено фактическое состояние регионов.',aiPriority:10,effects:[{kind:'metric',metric:'stability',amount:1},{kind:'schedule',eventId:'recovery-review',months:6}]}
  ]},
 {id:'recovery-review',title:'Проверка восстановления',category:'Recovery',illustration:'Recovery',description:'Инспекторы сравнивают восстановленные здания с обещаниями правительства.',fromYear:1,toYear:9999,deadlineMonths:2,fallbackChoiceId:'more-work',options:[
  {id:'rebuilt',title:'Завершить программу',description:'Если повреждённых регионов больше нет: стабильность +4, недовольство −2.',condition:{kind:'not',condition:{kind:'damaged',minimum:1}},aiPriority:100,effects:[{kind:'metric',metric:'stability',amount:4},{kind:'metric',metric:'unrest',amount:-2}]},
  {id:'more-work',title:'Продолжить восстановление',description:'Открыть послевоенный курс. Ремонт по-прежнему требует средств и материалов.',aiPriority:10,effects:[{kind:'unlockFocus',focusId:'event-postwar-renewal'}]}
 ]}
];
const catalogue=new Map(DOMINION_EVENTS.map(event=>[event.id,event]));
export function eventDefinition(id:string):EventDefinition|undefined{return catalogue.get(id);}
