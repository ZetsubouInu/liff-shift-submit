// ご指定のLIFF IDとGASウェブアプリURLを設定済みです
const LIFF_ID = "2010473243-llp7zgX9";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbypCrFMOhWZa-RyJHdBPKjmZ6dP-YCZXcLrXBnxWmzPWTdNmvjvpDc66wYhf38GZv9U/exec";

document.addEventListener('DOMContentLoaded', () => {
    liff.init({ liffId: LIFF_ID }).then(() => {
        if (!liff.isLoggedIn()) {
            liff.login(); 
        } else {
            checkRegistration();
        }
    }).catch(err => console.error("LIFF初期化失敗", err));

    document.getElementById('save-name-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('genji-name-input').value.trim();
        if (nameInput === "") {
            alert("源氏名を入力してください");
            return;
        }
        localStorage.setItem('castGenjiName', nameInput);
        checkRegistration();
    });

    document.getElementById('submit-shift-btn').addEventListener('click', () => {
        submitShiftData();
    });

    document.getElementById('tab-submit').addEventListener('click', () => {
        switchTab('submit');
    });
    document.getElementById('tab-view').addEventListener('click', () => {
        switchTab('view');
        fetchViewShifts(); 
    });
});

function checkRegistration() {
    const savedName = localStorage.getItem('castGenjiName');
    if (savedName) {
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('shift-section').style.display = 'block';
        document.getElementById('display-genji-name').textContent = savedName;
        
        fetchAndRenderShiftForm(); 
    } else {
        document.getElementById('register-section').style.display = 'block';
        document.getElementById('shift-section').style.display = 'none';
    }
}

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

function generateTimeOptions(startHour) {
    let options = '<option value="">休み</option>';
    options += '<option value="27:00">LAST</option>'; 
    
    for (let hour = startHour; hour <= 26; hour++) {
        options += `<option value="${hour}:00">${hour}:00</option>`;
        options += `<option value="${hour}:30">${hour}:30</option>`;
    }
    return options;
}

// データ取得と「対象週」のブロック生成、および締め切り処理を行う関数
function fetchAndRenderShiftForm() {
    const savedName = localStorage.getItem('castGenjiName');
    const url = `${GAS_WEB_APP_URL}?castName=${encodeURIComponent(savedName)}`;
    
    const holidayApiUrl = "https://holidays-jp.github.io/api/v1/date.json";
    
    const container = document.getElementById('calendar-container');
    const submitBtn = document.getElementById('submit-shift-btn');
    const titleEl = document.getElementById('target-week-title');

    if (titleEl) titleEl.style.display = 'none'; 
    container.innerHTML = '<p style="text-align: center; padding: 20px;">提出状況を確認中...</p>';
    submitBtn.style.display = 'none';

    Promise.all([
        fetch(url).then(res => res.json()),
        fetch(holidayApiUrl).then(res => res.json()).catch(() => ({}))
    ])
    .then(([resData, holidayData]) => {
        if (resData.status === "success") {
            const fetchedData = resData.data;

            const today = new Date();
            const dayOfWeek = today.getDay(); // 0:日, 1:月, 2:火, 3:水, 4:木, 5:金, 6:土

            // 金・土・日の判定（週末モード）
            const isWeekendMode = (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0);
            let html = "";

            // 週末に開いた場合のみ、画面上部にメッセージを表示する
            if (isWeekendMode) {
                html += `
                    <div style="background: #fee2e2; border: 1px solid #fca5a5; padding: 15px; border-radius: 5px; text-align: center; margin-bottom: 20px; line-height: 1.6;">
                        <p style="color: #c53030; font-weight: bold; font-size: 14px; margin: 0;">来週の追加シフト・修正があったら<br>トークルームに直接送信をお願いいたします！</p>
                    </div>
                `;
            }

            // 対象週（月曜〜日曜）の日付配列を生成する
            const targetWeekDates = [];
            // 日曜(0)なら翌日(+1)、月〜土(1〜6)なら次の月曜までの日数(8-曜日)
            let daysToNextMonday = (dayOfWeek === 0) ? 1 : (8 - dayOfWeek);
            
            // 金・土・日の場合は「再来週」にするため、さらに7日足す
            if (isWeekendMode) {
                daysToNextMonday += 7;
            }

            const targetMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToNextMonday);
            const targetSunday = new Date(targetMonday.getFullYear(), targetMonday.getMonth(), targetMonday.getDate() + 6);
            
            let curr = new Date(targetMonday);
            while (curr <= targetSunday) {
                targetWeekDates.push(new Date(curr));
                curr.setDate(curr.getDate() + 1);
            }

            function hasSubmission(dateArray) {
                return dateArray.some(dateObj => {
                    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                    return fetchedData.some(shift => {
                        const d = new Date(shift.dateValue);
                        const shiftDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                        return shiftDateStr === dateStr;
                    });
                });
            }

            const targetWeekLocked = hasSubmission(targetWeekDates);

            function getLockedMessageHtml(label) {
                return `
                    <div style="background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 15px; border-radius: 5px; margin-bottom: 20px; text-align: center;">
                        <p style="font-weight: bold; margin-bottom: 10px;">✅ ${label}のシフトは提出済みです</p>
                        <p style="font-size: 14px; margin: 0;">変更したい場合は、<br><span style="color: red; font-weight: bold;">トークルームに直接入力をお願いします！</span></p>
                    </div>
                `;
            }

            // ブロックのタイトルを曜日に応じて切り替える
            const blockLabel = isWeekendMode ? "再来週" : "来週";
            const ns = `${targetWeekDates[0].getMonth() + 1}/${targetWeekDates[0].getDate()}`;
            const ne = `${targetWeekDates[targetWeekDates.length - 1].getMonth() + 1}/${targetWeekDates[targetWeekDates.length - 1].getDate()}`;
            
            html += `<h3 style="margin-top: 10px; border-bottom: 2px solid #06C755; padding-bottom: 5px; font-size: 16px;">${blockLabel}のシフト (${ns} 〜 ${ne})</h3>`;

            if (targetWeekLocked) {
                html += getLockedMessageHtml(blockLabel);
            } else {
                html += generateDaysHtml(targetWeekDates, holidayData);
            }

            container.innerHTML = html;

            if (!targetWeekLocked) {
                submitBtn.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = "シフトを提出する";
            } else {
                submitBtn.style.display = 'none';
            }
        }
    })
    .catch(err => {
        console.error("データ確認エラー:", err);
        container.innerHTML = '<p style="text-align: center; color: red;">データの読み込みに失敗しました。</p>';
    });
}

// カレンダー部分のHTML生成関数
function generateDaysHtml(datesArray, holidayData) {
    const daysOfWeekArray = ["日", "月", "火", "水", "木", "金", "土"];
    let html = '';

    datesArray.forEach((date) => {
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        const fullDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayOfWeek = date.getDay(); 
        const dayStr = daysOfWeekArray[dayOfWeek];

        const tomorrow = new Date(date);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
        
        const isTomorrowHoliday = !!holidayData[tomorrowStr];

        html += `
            <div class="day-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <div class="day-label" style="font-size: 14px; font-weight: bold; width: 35%;">${dateStr} (${dayStr})</div>
        `;

        if (dayOfWeek === 1 && !isTomorrowHoliday) {
            html += `
                <div class="time-selects" style="width: 65%; display: flex; justify-content: flex-end; align-items: center;">
                    <span style="color: #ff3b30; font-weight: bold; font-size: 14px; padding-right: 10px;">定休日</span>
                    <input type="hidden" class="start-time" data-date="${fullDateStr}" value="">
                    <input type="hidden" class="end-time" data-date="${fullDateStr}" value="">
                </div>
            `;
        } else {
            const startHour = (dayOfWeek === 0 || dayOfWeek === 6) ? 15 : 18;
            const timeOptions = generateTimeOptions(startHour);

            html += `
                <div class="time-selects" style="width: 65%; display: flex; justify-content: flex-end; align-items: center;">
                    <select class="start-time" data-date="${fullDateStr}" style="padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px;">
                        ${timeOptions}
                    </select>
                    <span class="time-separator" style="margin: 0 5px; color: #666;">〜</span>
                    <select class="end-time" data-date="${fullDateStr}" style="padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px;">
                        ${timeOptions}
                    </select>
                </div>
            `;
        }
        
        html += `</div>`; 
    });
    return html;
}

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

    if (shifts.length === 0) {
        alert("送信するシフトデータがありません。");
        return;
    }

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
        checkRegistration(); 
    })
    .catch(err => {
        console.error("送信エラー:", err);
        alert("送信に失敗しました。");
        submitBtn.disabled = false;
        submitBtn.textContent = "シフトを提出する";
    });
}

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