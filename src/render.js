const child_process = require('child_process')
const path = require('path');
const fs = require('fs');
const remote = require('@electron/remote');
const EventEmitter = require('events')

const arduino_cli_path = path.join(remote.app.getAppPath(), 'arduino-cli\\arduino-cli.exe ');
const arduino_cli_libraries = path.join(remote.app.getAppPath(), 'arduino-cli\\\\libraries')
const arduino_cli_board_url = 'https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json';

const airqua_token = document.getElementById('airqua_token');
const airqua_id = document.getElementById('airqua_id');
const airqua_submit = document.getElementById('airqua_submit');
const airqua_log = document.getElementById('airqua_log');

let cmd;
let ended;
const events = new EventEmitter();
airqua_submit.onclick = function () {
    ended = false;
    airqua_submit.disabled = true;
    airqua_token.readonly = true;
    airqua_id.readonly = true;
    airqua_submit.innerText = "Прошиваем...";
    airqua_log.value = '';
    log('Прошиваем...');

    let out = '';
    let port;
    cmd = child_process.spawn('cmd.exe', ['/K'], {
        shell: true
    });
    cmd.stdout.setEncoding('utf-8');
    cmd.stdin.setDefaultEncoding('utf-8');
    cmd.stdout.on('data', d => {
        if(d.includes('>')) return;
        log(d);
        out += d;
        if(d.includes('Port')) { //todo костыль :)
            d.split('\n').forEach(st => {
                if(st.includes('seeed_wio_terminal')) {
                    port = st.split(' ')[0];
                    log('Порт Wio Terminal: ' + port);
                    events.emit('port');
                }
            })
            if(!port) end('Wio Terminal не подключен.', true);
        } else if(d.includes('Verify successful')) {
            end('Прошивка успешно установлена.');
        }
    })
    cmd.stderr.on('data', e => end(e, true));

    // settings values to sketch
    const sketch_main = path.join(remote.app.getAppPath(), 'arduino-cli\\WioTerminal\\WioTerminal.ino');
    let file = fs.readFileSync(sketch_main, { encoding: 'utf-8' });
    file = file.replace('abcdefghijklmnopqrstuvwxyz0123456789', airqua_token.value);
    file = file.replace('d0', 'd' + airqua_id.value.toString());
    fs.writeFileSync(sketch_main, file, { encoding: 'utf-8' });
    log('Введенные данные применены.');

    write(`${arduino_cli_path} board list --additional-urls ${arduino_cli_board_url}`); //getting wio's port
    events.on('port', () => {
        write(`${arduino_cli_path} core update-index --additional-urls ${arduino_cli_board_url}`); // installing core
        write(`${arduino_cli_path} compile -b Seeeduino:samd:seeed_wio_terminal --additional-urls ${arduino_cli_board_url} -u -t -p ${port} --libraries ${arduino_cli_libraries} ` +
            path.join(remote.app.getAppPath(), 'arduino-cli\\WioTerminal')) // compiling and uploading
    })
}

function write(data) {
    if(!ended) cmd.stdin.write(data + '\r\n');
}

function log(msg) {
    airqua_log.value += msg + '\n';
    airqua_log.scrollTop = airqua_log.scrollHeight;
}

function end(msg = '', error = false) {
    ended = true;
    cmd.kill();
    airqua_submit.disabled = false;
    airqua_token.readonly = false;
    airqua_id.readonly = false;
    airqua_submit.innerText = "Прошить";
    log(msg);
    fs.writeFile(path.join(remote.app.getAppPath(), 'log.txt'), airqua_log.value, (err) => {
        if(err) log('Ошибка при создании файла log.txt: ' + err);
        else log('Файл log.txt успешно создан.');
    })
    if(error) log('Процесс записи прошивки завершился с ошибкой. Отправьте файл resources/app/log.txt из корня программы на почту support@airqua.ru.');
}
