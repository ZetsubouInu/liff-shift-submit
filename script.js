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
        
        fetchAndRenderShiftForm(); // 統合した新しい関数を呼び出す
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

function generateTimeOptions() {
    let options = '<option value="">休み</option>';
    options += '<option value="27:00">LAST</option>'; 
    
    for (let hour = 18; hour <= 26; hour++) {
        options += `<option value="${hour}:00">${hour}:00</option>`;
        options += `<option value="${hour}:30">${hour}:30</option>`;
    }
    return options;
}

// 【新規】データ取得と「今週」「来週」のブロック分割生成を行う関数
function fetchAndRenderShiftForm() {
    const savedName = localStorage.getItem('castGenjiName');
    const url = `${GAS_WEB_APP_URL}?castName=${encodeURIComponent(savedName)}`;
    
    const container = document.getElementById('calendar-container');
    const submitBtn = document.getElementById('submit-shift-btn');
    const titleEl = document.getElementById('target-week-title');

    // 初期表示リセット
    if (titleEl) titleEl.style.display = 'none'; // 古い見出しは非表示
    container.innerHTML = '<p style="text-align: center; padding: 20px;">提出状況を確認中...</p>';
    submitBtn.style.display = 'none';

    fetch(url)
    .then(res => res.json())
    .then(resData => {
        if (resData.status === "success") {
            const fetchedData = resData.data;

            // --- 日付の計算 ---
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0:日, 1:月...
            const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

            // ① 今週の配列（明日 〜 今週の日曜日）
            const thisWeekDates = [];
            if (dayOfWeek !== 0) { // 今日が日曜日でなければ生成
                const daysToSunday = 7 - dayOfWeek;
                const thisSunday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToSunday);
                let curr = new Date(tomorrow);
                while (curr <= thisSunday) {
                    thisWeekDates.push(new Date(curr));
                    curr.setDate(curr.getDate() + 1);
                }
            }

            // ② 来週の配列（来週の月曜日 〜 来週の日曜日）
            const nextWeekDates = [];
            const daysToNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
            const nextMonday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysToNextMonday);
            const nextSunday = new Date(nextMonday.getFullYear(), nextMonday.getMonth(), nextMonday.getDate() + 6);
            let curr2 = new Date(nextMonday);
            while (curr2 <= nextSunday) {
                nextWeekDates.push(new Date(curr2));
                curr2.setDate(curr2.getDate() + 1);
            }

            // --- 提出済み（ロック）の判定 ---
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

            const thisWeekLocked = hasSubmission(thisWeekDates);
            const nextWeekLocked = hasSubmission(nextWeekDates);

            // --- HTMLの組み立て ---
            let html = "";

            function getLockedMessageHtml(label) {
                return `
                    <div style="background: #fff3cd; border: 1px solid #ffeeba; color: #856404; padding: 15px; border-radius: 5px; margin-bottom: 20px; text-align: center;">
                        <p style="font-weight: bold; margin-bottom: 10px;">✅ ${label}のシフトは提出済みです</p>
                        <p style="font-size: 14px; margin: 0;">変更したい場合は、<br><span style="color: red; font-weight: bold;">トークルームに直接入力をお願いします！</span></p>
                    </div>
                `;
            }

            // 今週ブロックの描画
            if (thisWeekDates.length > 0) {
                const s = `${thisWeekDates[0].getMonth() + 1}/${thisWeekDates[0].getDate()}`;
                const e = `${thisWeekDates[thisWeekDates.length - 1].getMonth() + 1}/${thisWeekDates[thisWeekDates.length - 1].getDate()}`;
                html += `<h3 style="margin-top: 10px; border-bottom: 2px solid #06C755; padding-bottom: 5px; font-size: 16px;">今週のシフト (${s} 〜 ${e})</h3>`;

                if (thisWeekLocked) {
                    html += getLockedMessageHtml("今週");
                } else {
                    html += generateDaysHtml(thisWeekDates);
                }
            }

            // 来週ブロックの描画
            const ns = `${nextWeekDates[0].getMonth() + 1}/${nextWeekDates[0].getDate()}`;
            const ne = `${nextWeekDates[nextWeekDates.length - 1].getMonth() + 1}/${nextWeekDates[nextWeekDates.length - 1].getDate()}`;
            html += `<h3 style="margin-top: 30px; border-bottom: 2px solid #06C755; padding-bottom: 5px; font-size: 16px;">来週のシフト (${ns} 〜 ${ne})</h3>`;

            if (nextWeekLocked) {
                html += getLockedMessageHtml("来週");
            } else {
                html += generateDaysHtml(nextWeekDates);
            }

            container.innerHTML = html;

            // 送信ボタンの制御（両方ロックなら隠す、どちらか開いていれば表示）
            if ((thisWeekDates.length > 0 && !thisWeekLocked) || !nextWeekLocked) {
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
function generateDaysHtml(datesArray) {
    const daysOfWeekArray = ["日", "月", "火", "水", "木", "金", "土"];
    const timeOptions = generateTimeOptions();
    let html = '';

    datesArray.forEach((date) => {
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        const fullDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const dayStr = daysOfWeekArray[date.getDay()];

        // styleタグを直接入れてレイアウト崩れを防止
        html += `
            <div class="day-row" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
                <div class="day-label" style="font-size: 14px; font-weight: bold; width: 35%;">${dateStr} (${dayStr})</div>
                <div class="time-selects" style="width: 65%; display: flex; justify-content: flex-end; align-items: center;">
                    <select class="start-time" data-date="${fullDateStr}" style="padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px;">
                        ${timeOptions}
                    </select>
                    <span class="time-separator" style="margin: 0 5px; color: #666;">〜</span>
                    <select class="end-time" data-date="${fullDateStr}" style="padding: 6px; border-radius: 4px; border: 1px solid #ccc; font-size: 14px;">
                        ${timeOptions}
                    </select>
                </div>
            </div>
        `;
    });
    return html;
}

function submitShiftData() {
    const savedName = localStorage.getItem('castGenjiName');
    const shifts = [];
    const startElements = document.querySelectorAll('.start-time');
    const endElements = document.querySelectorAll('.end-time');

    // ロックされていない（画面に表示されている）入力項目だけを取得
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
        checkRegistration(); // 画面を再描画して最新のロック状態に更新
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