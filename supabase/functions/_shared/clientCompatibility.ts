import {CURRENT_STATE_VERSION} from './stateMigrations.ts';
import {RequestError} from './requestValidation.ts';

/** A client must understand every active server system before a room can be
 * read, joined, advanced or mutated. Check before DB/presence/receipt access;
 * never disguise a future state as an older schema or silently change a room
 * for a client that cannot decode it. Existing local saves migrate normally. */
export function assertClientCompatibility(body:Record<string,unknown>):void {
  const version=body.clientStateVersion;
  if(version!==undefined&&(!Number.isSafeInteger(version)||Number(version)<1))throw new RequestError('Invalid client state version');
  if(version!==CURRENT_STATE_VERSION)throw new RequestError(version!==undefined&&Number(version)>CURRENT_STATE_VERSION
    ?'Сервер ещё не поддерживает эту версию Dominion. Повторите подключение после обновления сервера.'
    :'Для сетевой игры обновите Dominion до актуальной версии.',426);
}
