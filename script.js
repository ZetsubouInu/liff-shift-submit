// ご指定のLIFF IDとGASウェブアプリURLを設定済みです
const LIFF_ID = "2010473243-llp7zgX9";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyQfJe2XlHcUt5WWl7YEiggAGjJarZJ4U46g3ekrZ7xpAqB5eoQqr1437fTGSenw-JIOg/exec";

document.addEventListener('DOMContentLoaded', () => {
    // 1. LIFFの初期化
    liff.init({ liffId: LIFF_ID }).then(() => {
        if (!liff.isLoggedIn()) {
            liff.login(); 
        } else {
            checkRegistration();
        }
    }).catch(err => console.error("LIFF初期化失敗", err));

    // 2. 登録ボタンのイベント
    document.getElementById('save-name-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('genji-name-input').value.trim();
        if (nameInput === "") {
            alert("源氏名を入力してください");
            return;
        }
        localStorage.setItem('castGenjiName', nameInput);
        checkRegistration();
    });

    // 3. 提出ボタンのイベント
    document.getElementById('submit-shift-btn').addEventListener('click', () => {
        submitShiftData();
    });

    // 4. タブ切り替えイベントの追加
    document.getElementById('tab-submit').addEventListener('click', () => {
        switchTab('submit');
    });
    document.getElementById('tab-view').addEventListener('click', () => {
        switchTab('view');
        fetchViewShifts(); 
    });
});

// 登録状態のチェックと画面切り替え
function checkRegistration() {
    const savedName = localStorage.getItem('castGenjiName');
    if (savedName) {
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('shift-section').style.display = 'block';
        document.getElementById('display-genji-name').textContent = savedName;
        
        generateShiftForm(); 
        prefillShiftForm();  // データ確認とロック処理を実行
    } else {
        document.getElementById('register-section').style.display = 'block';
        document.getElementById('shift-section').style.display = 'none';
    }
}

// 時間の正規化関数（スプレッドシートの仕様対策）
function normalizeTime(timeStr) {
    if (!timeStr) return "";
    const parts = timeStr.split(":");
    if (parts.length >= 2) {
        let h = parseInt(parts[0], 10);
        if (h >= 0 && h <= 5) {
            h += 24;
            return `${h}:${parts[1]}`;
        }
    }
    return timeStr;
}

// 過去データを確認し、すでに提出済みならフォームをロックする関数
function prefillShiftForm() {
    const savedName = localStorage.getItem('castGenjiName');
    const url = `${GAS_WEB_APP_URL}?castName=${encodeURIComponent(savedName)}`;
    
    const submitBtn = document.getElementById('submit-shift-btn');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = "提出状況を確認中...";
    submitBtn.disabled = true;

    fetch(url)
    .then(res => res.json())
    .then(resData => {
        if (resData.status === "success") {
            const data = resData.data;
            const startElements = document.querySelectorAll('.start-time');
            
            let alreadySubmitted = false;

            // フォーム内の日付（来週の月〜日）に該当する提出済みデータが1つでもあるかチェック
            startElements.forEach((startEl) => {
                const dateStr = startEl.getAttribute('data-date');
                
                const existingShift = data.find(shift => {
                    const d = new Date(shift.dateValue);
                    const shiftDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    return shiftDateStr === dateStr;
                });
                
                if (existingShift) {
                    alreadySubmitted = true;
                }
            });

            const calendarContainer = document.getElementById('calendar-container');

            if (alreadySubmitted) {
                // 【ロック処理】すでに提出済みの場合はカレンダーとボタンを隠し、案内メッセージを表示する
                calendarContainer.style.display = 'none';
                submitBtn.style.display = 'none';

                let msgDiv = document.getElementById('submitted-message');
                if (!msgDiv) {
                    msgDiv = document.createElement('div');
                    msgDiv.id = 'submitted-message';
                    msgDiv.innerHTML = `
                        <div style="background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
                            <p style="font-weight: bold; margin-bottom: 10px;">✅ 来週のシフトは提出済みです</p>
                            <p style="font-size: 14px; margin: 0;">シフト変更したい場合、<br><span style="color: red; font-weight: bold;">トークルームに直接入力をお願いします！</span></p>
                        </div>
                    `;
                    document.getElementById('sector-submit').appendChild(msgDiv);
                }
                msgDiv.style.display = 'block';

            } else {
                // まだ提出していない場合は通常通りフォームを表示させる
                calendarContainer.style.display = 'block';
                submitBtn.style.display = 'block';
                submitBtn.textContent = "シフトを提出する";
                submitBtn.disabled = false;
                
                const msgDiv = document.getElementById('submitted-message');
                if (msgDiv) msgDiv.style.display = 'none';
            }
        }
    })
    .catch(err => {
        console.error("データ確認エラー:", err);
        submitBtn.textContent = "シフトを提出する";
        submitBtn.disabled = false;
    });
}

// タブの表示切り替えロジック
function switchTab(type) {
    const btnSubmit = document.getElementById('tab-submit');
    const btnView = document.getElementById('tab-view');
    const secSubmit = document.getElementById('sector-submit');
    const secView = document.getElementById('sector-view');

    if (type === 'submit') {
        btnSubmit.classList.add('active');
        btnView.classList.remove('active');
        secSubmit.style.display = 'block';
        secView.style.display = 'none';
    } else {
        btnSubmit.classList.remove('active');
        btnView.classList.add('active');
        secSubmit.style.display = 'none';
        secView.style.display = 'block';
    }
}

// ターゲットとなる「来週の月曜日」の日付を計算
function getTargetMonday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    let daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
    if (dayOfWeek >= 4 || dayOfWeek === 0) { 
        daysUntilNextMonday += 7; 
    }
    const targetMonday = new Date(today);
    targetMonday.setDate(today.getDate() + daysUntilNextMonday);
    return targetMonday;
}

function generateTargetWeekDates(baseDate) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(baseDate);
        currentDate.setDate(baseDate.getDate() + i);
        dates.push(currentDate);
    }
    return dates;
}

// プルダウンの選択肢を生成する関数
function generateTimeOptions() {
    let options = '<option value="">休み</option>';
    options += '<option value="27:00">LAST</option>'; 
    
    for (let hour = 18; hour <= 26; hour++) {
        options += `<option value="${hour}:00">${hour}:00</option>`;
        options += `<option value="${hour}:30">${hour}:30</option>`;
    }
    return options;
}

function generateShiftForm() {
    const container = document.getElementById('calendar-container');
    container.innerHTML = "";
    
    const daysOfWeek = ["月", "火", "水", "木", "金", "土", "日"];
    const timeOptions = generateTimeOptions();
    const targetMonday = getTargetMonday();
    const targetDates = generateTargetWeekDates(targetMonday);

    const startMonth = targetDates[0].getMonth() + 1;
    const startDate = targetDates[0].getDate();
    const endMonth = targetDates[6].getMonth() + 1;
    const endDate = targetDates[6].getDate();
    document.getElementById('target-week-title').textContent = 
        `対象期間: ${startMonth}/${startDate} 〜 ${endMonth}/${endDate}`;

    targetDates.forEach((date, index) => {
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        const fullDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const html = `
            <div class="day-row">
                <div class="day-label">${dateStr} (${daysOfWeek[index]})</div>
                <div class="time-selects">
                    <select class="start-time" data-date="${fullDateStr}">
                        ${timeOptions}
                    </select>
                    <span class="time-separator">〜</span>
                    <select class="end-time" data-date="${fullDateStr}">
                        ${timeOptions}
                    </select>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

// シフト提出データをGASへ送信（POST）
function submitShiftData() {
    const savedName = localStorage.getItem('castGenjiName');
    const shifts = [];
    const startElements = document.querySelectorAll('.start-time');
    const endElements = document.querySelectorAll('.end-time');

    startElements.forEach((startEl, index) => {
        const endEl = endElements[index];
        shifts.push({
            date: startEl.getAttribute('data-date'),
            start: startEl.value,
            end: endEl.value
        });
    });

    const submitData = { castName: savedName, shiftData: shifts };
    const submitBtn = document.getElementById('submit-shift-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = "送信中...";

    fetch(GAS_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData)
    })
    .then(() => {
        alert("シフトの提出が完了しました！");
        submitBtn.textContent = "提出完了";
        
        // 提出完了後、画面を再描画してロック状態にする
        checkRegistration();
    })
    .catch(err => {
        console.error("送信エラー:", err);
        alert("送信に失敗しました。");
        submitBtn.disabled = false;
        submitBtn.textContent = "シフトを提出する";
    });
}

// 提出済みシフトをGASから取得（GET）して画面に表示
function fetchViewShifts() {
    const savedName = localStorage.getItem('castGenjiName');
    const container = document.getElementById('shift-list-container');
    container.innerHTML = '<p style="text-align: center; color: #888;">読み込み中...</p>';

    const url = `${GAS_WEB_APP_URL}?castName=${encodeURIComponent(savedName)}`;

    fetch(url)
    .then(res => res.json())
    .then(resData => {
        if (resData.status === "success") {
            const data = resData.data;
            if (data.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #888; padding: 20px;">提出済みのシフトはありません。</p>';
                return;
            }

            container.innerHTML = ""; 
            data.forEach(shift => {
                let timeStr = "休み";
                if (shift.start || shift.end) {
                    let s = normalizeTime(shift.start);
                    let e = normalizeTime(shift.end);
                    const startText = s === "27:00" ? "LAST" : (s || "未定");
                    const endText = e === "27:00" ? "LAST" : (e || "未定");
                    timeStr = `${startText} 〜 ${endText}`;
                }

                const html = `
                    <div class="view-day-row">
                        <div class="view-date">${shift.dateLabel}</div>
                        <div class="view-time">${timeStr}</div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        } else {
            container.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">データの取得に失敗しました。</p>';
        }
    })
    .catch(err => {
        console.error("データ取得エラー:", err);
        container.innerHTML = '<p style="text-align: center; color: red; padding: 20px;">通信エラーが発生しました。</p>';
    });
}