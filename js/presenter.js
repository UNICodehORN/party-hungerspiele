const box = document.querySelector('.content-box');
const fireBorder = document.querySelector('.fire-border');

// 50 Partikel dynamisch erzeugen
for (let i = 0; i < 50; i++) {
    const span = document.createElement('span');
    span.className = 'particle';
    span.style.left = `${Math.random() * 100}%`;
    span.style.animationDelay = `${Math.random()}s`;
    fireBorder.appendChild(span);
}

const API_BASE = "api/index.php";
const API_URL = `${API_BASE}?action=getGameState`;
const presenterContent = document.getElementById("presenter-content");

// Polling starten
let gameStateStored = null;
setInterval(updatePresenterView, 2000);

async function updatePresenterView() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        const serialized = JSON.stringify(data);
        if (gameStateStored !== serialized) {
            gameStateStored = serialized;
            const gameState = data.gameState;
            const currentRound = data.currentRound;
            const teams = data.teams || {};

            // === Highscore-Box anzeigen/ausblenden (hat höchste Priorität) ===
            const highscoreBox = document.getElementById("highscoreBox");
            if (gameState.displayHighscore) {
                highscoreBox.style.display = "block";
                await refreshScores();
            } else {
                highscoreBox.style.display = "none";
            }

            presenterContent.innerHTML = ""; // Inhalt löschen
            const heading = document.createElement("h2");

            if (gameState.round === 0 && gameState.roundProgress === 0) {
                // Wartephase
                box.classList.add("pulsing");
                heading.setAttribute('style', 'white-space: pre;');
                heading.textContent = "Das Spiel wird gleich gestartet...";
                presenterContent.appendChild(heading);

            } else if (gameState.round === 0 && gameState.roundProgress === 1) {
                // Anmeldephase
                box.classList.add("pulsing");
                const totalPlayers = Object.values(teams)
                    .reduce((sum, team) => sum + Object.keys(team.players || {}).length, 0);

                heading.textContent = `Spieler angemeldet: ${totalPlayers}`;
                presenterContent.appendChild(heading);

                // Team mit wenigsten Spielern (<3) finden
                let minPlayers = Infinity;
                let teamWithFewest = null;
                for (const [teamName, teamData] of Object.entries(teams)) {
                    const count = Object.keys(teamData.players || {}).length;
                    if (count < minPlayers) {
                        minPlayers = count;
                        teamWithFewest = teamName;
                    }
                }
                const subHeading = document.createElement("p");
                subHeading.setAttribute('style', 'white-space: pre;');
                subHeading.textContent = "Öffne die Spieleransicht, um mitzuspielen."
                if (minPlayers < 1) {
                    subHeading.textContent += `\r\n \r\n ${teamWithFewest} wartet auf Mitspieler...`;
                }
                presenterContent.appendChild(subHeading);

            } else {
                if (currentRound.roundProgress === 0) {
                    // Intro-Phase
                    box.classList.add("pulsing");
                } else {
                    box.classList.remove("pulsing");
                }
                renderCurrentRound(currentRound);
            }

            // Optional: Fire-Border immer anzeigen
            const fireBorder = document.createElement("div");
            fireBorder.className = "fire-border";
            presenterContent.appendChild(fireBorder);
        }
    } catch (err) {
        console.error("Fehler beim Laden des GameState für Presenter:", err);
    }
}

/**
 * Rendert die aktuelle Runde
 */
function renderCurrentRound(currentRound) {
    const heading = document.createElement("h2");
    heading.textContent = `Runde ${currentRound.round}`;
    presenterContent.appendChild(heading);

    if (currentRound.roundProgress === 0) {
        if (currentRound.intro) {
            const introP = document.createElement("p");
            introP.textContent = currentRound.intro;
            introP.style.marginTop = "1rem";
            introP.style.fontSize = "1.2rem";
            presenterContent.appendChild(introP);
        }
    } else {
        if (currentRound.element.photo) {
            const img = document.createElement("img");
            img.id = "displayedPhoto"
            img.src = `images/${currentRound.element.photo}`;
            img.alt = "Rundenbild";
            img.style.maxHeight = "500px";
            img.style.width = "auto";
            img.style.display = "block";
            img.style.margin = "1rem auto";
            presenterContent.appendChild(img);
        }
        else if (currentRound.element.question) {
            const txtContainer = document.createElement("div");
            txtContainer.id = "displayedQuestion"

            // Question
            const txtElem = document.createElement("span");
            txtElem.textContent = currentRound.element.question;
            txtElem.style.fontSize = "4rem";
            txtContainer.appendChild(txtElem);

            // Answers als Buttons (ohne Funktion)
            const answersContainer = document.createElement("div");
            answersContainer.classList.add("answers-container");

            (currentRound.element.answers || []).forEach((answer) => {
                const btn = document.createElement("button");
                btn.textContent = answer;
                btn.style.fontSize = "2rem";
                btn.classList.add("answerBtn");
                btn.disabled = true; // klick deaktivieren
                answersContainer.appendChild(btn);
            });

            txtContainer.appendChild(answersContainer);

            // DOM
            presenterContent.appendChild(txtContainer);
        }

        const timerWrapper = document.createElement("div");
        timerWrapper.id = "progressBar"
        timerWrapper.style.display = "flex";
        timerWrapper.style.alignItems = "center";
        timerWrapper.style.gap = "1rem";
        timerWrapper.style.marginTop = "1rem";

        const timeLeftEl = document.createElement("span");
        timeLeftEl.style.fontSize = "1.2rem";
        timeLeftEl.style.minWidth = "80px";
        timerWrapper.appendChild(timeLeftEl);

        const barWrapper = document.createElement("div");
        barWrapper.style.flexGrow = "1";
        barWrapper.style.height = "20px";
        barWrapper.style.background = "#eee";
        barWrapper.style.borderRadius = "10px";
        barWrapper.style.overflow = "hidden";

        const bar = document.createElement("div");
        bar.style.height = "100%";
        bar.style.background = "#27ae60";
        bar.style.width = "100%";
        barWrapper.appendChild(bar);

        timerWrapper.appendChild(barWrapper);
        presenterContent.appendChild(timerWrapper);

        startCountdown(currentRound.until, timeLeftEl, bar);
    }
}

/**
 * Countdown
 */
function startCountdown(untilStr, timeLeftEl, bar) {
    const until = new Date(untilStr).getTime();
    const totalTime = until - Date.now();
    let timerInterval;

    function updateTimer() {
        const now = Date.now();
        const remaining = Math.max(0, until - now);
        const sec = Math.floor(remaining / 1000);
        const min = Math.floor(sec / 60);
        const secRest = sec % 60;
        timeLeftEl.textContent = `${min}:${secRest.toString().padStart(2, "0")}`;
        const percent = Math.max(0, remaining / totalTime);
        bar.style.width = `${percent * 100}%`;

        if (remaining < 10000) bar.style.background = "#e74c3c";

        if (remaining <= 0) {
            clearInterval(timerInterval);
            timeLeftEl.textContent = "0:00";
            bar.style.width = "0%";
            let photo = document.getElementById('displayedPhoto');
            if (photo != undefined)
                photo.style.display = 'none';
            let quiz = document.getElementById('displayedQuestion');
            if (quiz != undefined)
                quiz.style.display = 'none';
            // Text "Zeit abgelaufen!" einblenden
            let expiredMsg = document.getElementById('expiredMsg');
            if (!expiredMsg) {
                expiredMsg = document.createElement('div');
                expiredMsg.id = 'expiredMsg';
                expiredMsg.textContent = "⏰ Zeit abgelaufen!";
                expiredMsg.style.fontSize = "6rem";
                expiredMsg.style.fontWeight = "bold";
                expiredMsg.style.color = "#c0392b";
                expiredMsg.style.textAlign = "center";
                expiredMsg.style.marginTop = "20px";

                // über den Balken einfügen
                let barWrapper = document.getElementById('progressBar');
                barWrapper.parentElement.insertBefore(expiredMsg, barWrapper);
            }
        }
    }

    updateTimer();
    timerInterval = setInterval(updateTimer, 500);
}

const apiUrl = `${API_BASE}?action=getHighscoreAllTeams`;

/**
 * Animiertes Update der Punkte
 */
function updatePoints(teamName, newPoints) {
    const teamEntry = document.querySelector(`.entry[data-team="${teamName}"]`);
    if (!teamEntry) {
        console.error(`Team ${teamName} nicht gefunden`);
        return;
    }

    const scoreEl = teamEntry.querySelector('.score');
    const bar = teamEntry.querySelector('.bar');
    const oldPoints = parseInt(teamEntry.dataset.score);
    if (oldPoints === newPoints) return; // nichts zu tun

    teamEntry.dataset.score = newPoints;

    const maxScore = Math.max(...[...document.querySelectorAll('.entry')].map(e => parseInt(e.dataset.score)), newPoints);
    let currentPoints = oldPoints;
    const step = (newPoints - oldPoints) / 150; // 150 Frames animieren

    function animate() {
        currentPoints += step;
        if ((step > 0 && currentPoints >= newPoints) || (step < 0 && currentPoints <= newPoints)) {
            currentPoints = newPoints;
        }

        scoreEl.textContent = Math.round(currentPoints) + ' Punkte';

        // Balkenbreite proportional zur Punktzahl
        const widthPercent = (currentPoints / maxScore) * 100;
        bar.style.width = widthPercent + '%';

        scoreEl.style.textAlign = 'right';
        scoreEl.style.paddingRight = '10px';
        scoreEl.style.paddingLeft = '5px';

        if (currentPoints !== newPoints) {
            requestAnimationFrame(animate);
        } else {
            sortEntry(teamEntry);
        }
    }

    animate();
}

/**
 * Sortiert die Einträge nach Punkten mit Animation
 */
function sortEntry(entry) {
    const parent = entry.parentElement;
    const entries = [...parent.querySelectorAll('.entry')];
    const sortedEntries = [...entries].sort((a, b) => parseInt(b.dataset.score) - parseInt(a.dataset.score));
    const targetIndex = sortedEntries.indexOf(entry);
    const currentIndex = entries.indexOf(entry);

    if (currentIndex === targetIndex) return;

    entry.style.transition = 'transform 0.3s';
    entry.style.transform = 'scale(1.05)';

    const offset = (targetIndex - currentIndex) * entry.offsetHeight;

    requestAnimationFrame(() => {
        entry.style.transition = 'transform 1s ease';
        entry.style.transform = `translateY(${offset}px) scale(1.05)`;
    });

    setTimeout(() => {
        entry.style.transition = '';
        entry.style.transform = '';
        parent.insertBefore(entry, parent.children[targetIndex]);

        // Ränge + Top3 Farben
        const finalEntries = [...parent.querySelectorAll('.entry')];
        finalEntries.forEach((e, i) => {
            e.querySelector('.rank').textContent = i + 1;
            e.dataset.rank = i + 1;
            e.classList.remove('gold', 'silver', 'bronze');
            if (i === 0) e.classList.add('gold');
            else if (i === 1) e.classList.add('silver');
            else if (i === 2) e.classList.add('bronze');
        });
    }, 1100);
}

/**
 * Initialisiert Balken
 */
function initScores(initialScores) {
    initialScores.forEach(item => {
        const teamEntry = document.querySelector(`.entry[data-team="${item.team}"]`);
        if (!teamEntry) {
            console.warn(`Team ${item.team} nicht gefunden`);
            return;
        }

        const bar = teamEntry.querySelector('.bar');
        const scoreEl = teamEntry.querySelector('.score');

        teamEntry.dataset.score = item.points;
        scoreEl.textContent = item.points + ' Punkte';

        const allScores = initialScores.map(e => e.points);
        const maxScore = Math.max(...allScores, 1);
        const widthPercent = (item.points / maxScore) * 100;
        bar.style.width = widthPercent + '%';
    });

    // Sortieren
    const entries = [...document.querySelectorAll('.entry')];
    entries.sort((a, b) => parseInt(b.dataset.score) - parseInt(a.dataset.score))
        .forEach(e => e.parentElement.appendChild(e));

    // Ränge + Top3
    const finalEntries = [...document.querySelectorAll('.entry')];
    finalEntries.forEach((e, i) => {
        e.querySelector('.rank').textContent = i + 1;
        e.dataset.rank = i + 1;
        e.classList.remove('gold', 'silver', 'bronze');
        if (i === 0) e.classList.add('gold');
        else if (i === 1) e.classList.add('silver');
        else if (i === 2) e.classList.add('bronze');
    });
}

/**
 * Lädt Daten von der API
 */
async function fetchScores() {
    try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error("API Fehler");
        return await res.json();
    } catch (err) {
        console.error("Fehler beim Laden:", err);
        return [];
    }
}

// Init beim Laden
window.addEventListener('DOMContentLoaded', async () => {
    const initialScores = await fetchScores();
    initScores(initialScores);
});

async function refreshScores() {
    const scores = await fetchScores();
    scores.forEach(item => {
        updatePoints(item.team, item.points);
    });
}