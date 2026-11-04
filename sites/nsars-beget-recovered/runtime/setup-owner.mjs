import {createInterface} from 'node:readline/promises';
import {randomUUID} from 'node:crypto';
import {sql} from './database.mjs';
import {verifier} from './auth.mjs';
if(!process.stdin.isTTY)throw Error('Run interactively');
if(sql.prepare('SELECT count(*) n FROM owner').get().n)throw Error('Owner already exists; refusing to overwrite access');
const rl=createInterface({input:process.stdin,output:process.stdout});
const username=(await rl.question('Логин для админки сайта: ')).trim();rl.close();
if(!/^[a-zA-Z0-9@._+-]{3,100}$/.test(username))throw Error('Недопустимый логин');
async function secret(prompt){process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();return new Promise((resolve,reject)=>{let value='';function read(chunk){for(const c of chunk.toString()){if(c==='\u0003'){done();reject(Error('Отменено'));return;}if(c==='\r'||c==='\n'){done();resolve(value);return;}if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else if(c>=' ')value+=c;}}function done(){process.stdin.off('data',read);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');}process.stdin.on('data',read);});}
const first=await secret('Новый пароль админки (не менее 14 символов, ввод скрыт): ');
if(first.length<14||first.length>256)throw Error('Пароль должен содержать от 14 до 256 символов');
const second=await secret('Повторите пароль: ');if(first!==second)throw Error('Пароли не совпали');
sql.exec('BEGIN IMMEDIATE');try{if(sql.prepare('SELECT count(*) n FROM owner').get().n)throw Error('Owner already exists');sql.prepare('INSERT INTO owner VALUES(?,?,?,?)').run(randomUUID(),username,verifier(first),new Date().toISOString());sql.exec('COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}
sql.close();console.log('Владелец создан. Админка: https://ns-ars.ru/admin');
