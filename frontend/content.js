(() => {
  if (document.getElementById("kukko")) return;

  const kukko = document.createElement("div");
  kukko.id = "kukko";

  kukko.innerHTML = `
    <div class="bubble"></div>

    <div class="bird">

      <!-- TAIL -->
      <div class="tail">
        <div class="tail-feather tail-back"></div>
        <div class="tail-feather tail-left"></div>
        <div class="tail-feather tail-center"></div>
        <div class="tail-feather tail-right"></div>
      </div>

      <!-- BODY -->
      <div class="body">

        <div class="chest-feathers"></div>

        <div class="belly"></div>

        <!-- WINGS -->
        <div class="wing left-wing">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>

        <div class="wing right-wing">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>

        <!-- HEAD -->
        <div class="head">

          <div class="crest crest-1"></div>
          <div class="crest crest-2"></div>
          <div class="crest crest-3"></div>

          <div class="cheek cheek-left"></div>
          <div class="cheek cheek-right"></div>

          <div class="brow brow-left"></div>
          <div class="brow brow-right"></div>

          <div class="eye left-eye">
            <div class="pupil"></div>
            <div class="shine"></div>
          </div>

          <div class="eye right-eye">
            <div class="pupil"></div>
            <div class="shine"></div>
          </div>

          <div class="beak">
            <div class="beak-top"></div>
            <div class="beak-bottom"></div>
            <div class="beak-line"></div>
          </div>

        </div>

        <!-- FEET -->
        <div class="foot left-foot">
          <i></i>
          <i></i>
          <i></i>
        </div>

        <div class="foot right-foot">
          <i></i>
          <i></i>
          <i></i>
        </div>

      </div>

    </div>
  `;

  document.documentElement.appendChild(kukko);

  const bubble = kukko.querySelector(".bubble");
  const pupils = kukko.querySelectorAll(".pupil");
  const head = kukko.querySelector(".head");

  let x = Math.max(30, window.innerWidth - 200);
  let y = Math.max(60, window.innerHeight - 270);

  let targetX = x;
  let targetY = y;

  let velocityX = 0;
  let velocityY = 0;

  let mouseX = -1000;
  let mouseY = -1000;

  let flying = false;
  let talking = false;
  let busy = false;

  let lastEscape = 0;
  let lastTyping = 0;

  let facing = -1;

  const phrases = [
    "HELLO! 👋",
    "LOOK AT ME.",
    "WHAT ARE YOU DOING?",
    "GIVE ME SEEDS!",
    "I'M BORED.",
    "PAY ATTENTION TO ME.",
    "STOP WORKING!",
    "KUKKO APPROVES 👍",
    "KUKKO DISAPPROVES.",
    "HELLOOOOO!",
    "I'M WATCHING YOU 👀",
    "CAN I HELP?",
    "NO.",
    "WHY?",
    "HEHE 😈",
    "FOLLOW ME.",
    "TIME FOR A BREAK!",
    "I HAVE AN IDEA.",
    "DON'T IGNORE ME.",
    "SEEEEEEDS.",
    "YOU LOOK BUSY.",
    "I'M SUPERVISING.",
    "GOOD JOB.",
    "THAT WAS WEIRD.",
    "INTERESTING..."
  ];

  const typingPhrases = [
    "HEY! THAT'S MY KEYBOARD.",
    "WHAT ARE YOU WRITING?",
    "LET ME SEE.",
    "I CAN TYPE TOO!",
    "STOP TYPING.",
    "KUKKO IS SUPERVISING.",
    "IS THAT IMPORTANT?",
    "YOU'RE TYPING VERY LOUDLY.",
    "I KNOW WHAT YOU'RE DOING.",
    "NEED A PARROT?",
    "FOCUS!",
    "PSSST..."
  ];


  /* ==========================================
     SPEECH
  ========================================== */

  function say(text, duration = 2300) {
    clearTimeout(say.timer);

    bubble.textContent = text;

    bubble.classList.remove("show");

    requestAnimationFrame(() => {
      bubble.classList.add("show");
    });

    kukko.classList.add("talking");
    talking = true;

    say.timer = setTimeout(() => {
      bubble.classList.remove("show");
      kukko.classList.remove("talking");
      talking = false;
    }, duration);
  }


  /* ==========================================
     MOUSE
  ========================================== */

  document.addEventListener(
    "mousemove",
    e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    },
    { passive: true }
  );


  /* ==========================================
     TARGET MOVEMENT
  ========================================== */

  function setTarget(tx, ty, panic = false) {

    const margin = 25;

    const maxX =
      Math.max(
        margin,
        window.innerWidth - 180
      );

    const maxY =
      Math.max(
        margin,
        window.innerHeight - 220
      );

    targetX =
      Math.max(
        margin,
        Math.min(maxX, tx)
      );

    targetY =
      Math.max(
        margin,
        Math.min(maxY, ty)
      );

    flying = true;

    kukko.classList.add("flying");

    if (panic) {
      kukko.classList.add("panic");
    }
  }


  /* ==========================================
     RANDOM FLIGHT
  ========================================== */

  function randomFlight() {

    if (
      !busy &&
      !flying &&
      Math.random() < .7
    ) {

      const tx =
        40 +
        Math.random() *
        Math.max(
          100,
          window.innerWidth - 230
        );

      const ty =
        50 +
        Math.random() *
        Math.max(
          100,
          window.innerHeight - 280
        );

      setTarget(tx, ty);

      if (Math.random() < .35) {
        say(
          Math.random() < .5
            ? "WATCH THIS!"
            : "I'M FLYING!",
          1300
        );
      }
    }

    setTimeout(
      randomFlight,
      6500 + Math.random() * 8500
    );
  }

  setTimeout(randomFlight, 4000);


  /* ==========================================
     CURSOR ESCAPE
  ========================================== */

  function checkCursor() {

    if (busy) return;

    const rect =
      kukko.getBoundingClientRect();

    const cx =
      rect.left +
      rect.width / 2;

    const cy =
      rect.top +
      rect.height / 2;

    const dx = cx - mouseX;
    const dy = cy - mouseY;

    const distance =
      Math.sqrt(
        dx * dx +
        dy * dy
      );

    const now = Date.now();

    if (
      distance < 125 &&
      distance > 1 &&
      now - lastEscape > 1800
    ) {

      lastEscape = now;

      const angle =
        Math.atan2(dy, dx);

      const distanceToEscape =
        250 +
        Math.random() * 180;

      setTarget(
        x +
        Math.cos(angle) *
        distanceToEscape,

        y +
        Math.sin(angle) *
        distanceToEscape,

        true
      );

      kukko.classList.add("scared");

      say(
        Math.random() < .5
          ? "TOO CLOSE! 😤"
          : "DON'T CATCH ME!",
        1500
      );

      setTimeout(() => {
        kukko.classList.remove("scared");
      }, 1200);
    }
  }


  /* ==========================================
     MAIN PHYSICS LOOP
  ========================================== */

  let previousTime =
    performance.now();

  function animate(now) {

    const dt =
      Math.min(
        32,
        now - previousTime
      );

    previousTime = now;

    const dx =
      targetX - x;

    const dy =
      targetY - y;

    const distance =
      Math.sqrt(
        dx * dx +
        dy * dy
      );

    if (flying) {

      const panic =
        kukko.classList.contains("panic");

      const acceleration =
        panic ? .0012 : .00065;

      velocityX +=
        dx * acceleration * dt;

      velocityY +=
        dy * acceleration * dt;

      const drag =
        panic ? .91 : .94;

      velocityX *= drag;
      velocityY *= drag;

      const maxSpeed =
        panic ? 8 : 5;

      const speed =
        Math.sqrt(
          velocityX * velocityX +
          velocityY * velocityY
        );

      if (speed > maxSpeed) {

        velocityX =
          velocityX /
          speed *
          maxSpeed;

        velocityY =
          velocityY /
          speed *
          maxSpeed;
      }

      x += velocityX;
      y += velocityY;

      if (Math.abs(velocityX) > .15) {

        facing =
          velocityX > 0
            ? 1
            : -1;
      }

      if (distance < 8) {

        flying = false;

        velocityX *= .35;
        velocityY *= .35;

        kukko.classList.remove(
          "flying",
          "panic"
        );
      }

    } else {

      /* subtle natural hovering */

      const time =
        now / 1000;

      x +=
        Math.sin(time * .55) *
        .018;

      y +=
        Math.sin(time * 1.7) *
        .035;
    }


    /* keep bird on screen */

    const maxX =
      Math.max(
        10,
        window.innerWidth - 180
      );

    const maxY =
      Math.max(
        20,
        window.innerHeight - 220
      );

    if (x < 10) {
      x = 10;
      velocityX *= -.3;
    }

    if (x > maxX) {
      x = maxX;
      velocityX *= -.3;
    }

    if (y < 20) {
      y = 20;
      velocityY *= -.3;
    }

    if (y > maxY) {
      y = maxY;
      velocityY *= -.3;
    }


    kukko.style.left =
      `${x}px`;

    kukko.style.top =
      `${y}px`;

    kukko.style.setProperty(
      "--direction",
      facing
    );


    checkCursor();

    requestAnimationFrame(
      animate
    );
  }

  requestAnimationFrame(
    animate
  );


  /* ==========================================
     EYES TRACK CURSOR
  ========================================== */

  function eyeTracking() {

    const rect =
      kukko.getBoundingClientRect();

    const eyeCenterX =
      rect.left +
      rect.width / 2;

    const eyeCenterY =
      rect.top +
      60;

    const dx =
      mouseX -
      eyeCenterX;

    const dy =
      mouseY -
      eyeCenterY;

    const angle =
      Math.atan2(dy, dx);

    const amount =
      Math.min(
        4.5,
        Math.sqrt(
          dx * dx +
          dy * dy
        ) / 110
      );

    const offsetX =
      Math.cos(angle) *
      amount;

    const offsetY =
      Math.sin(angle) *
      amount;

    pupils.forEach(
      pupil => {
        pupil.style.transform =
          `translate(
            ${offsetX}px,
            ${offsetY}px
          )`;
      }
    );

    requestAnimationFrame(
      eyeTracking
    );
  }

  eyeTracking();


  /* ==========================================
     BLINK
  ========================================== */

  function blink() {

    if (
      !talking &&
      Math.random() < .9
    ) {

      kukko.classList.add(
        "blink"
      );

      setTimeout(() => {

        kukko.classList.remove(
          "blink"
        );

      }, 110);

      /* occasional double blink */

      if (Math.random() < .18) {

        setTimeout(() => {

          kukko.classList.add(
            "blink"
          );

          setTimeout(() => {
            kukko.classList.remove(
              "blink"
            );
          }, 100);

        }, 190);
      }
    }

    setTimeout(
      blink,
      2500 +
      Math.random() * 4500
    );
  }

  setTimeout(
    blink,
    2000
  );


  /* ==========================================
     HEAD MOVEMENT
  ========================================== */

  function headBehavior() {

    if (!busy) {

      const choice =
        Math.random();

      if (choice < .4) {

        head.style.setProperty(
          "--tilt",
          `${(Math.random() - .5) * 16}deg`
        );

      } else {

        head.style.setProperty(
          "--head-x",
          `${(Math.random() - .5) * 7}px`
        );
      }

      setTimeout(() => {

        head.style.setProperty(
          "--tilt",
          "0deg"
        );

        head.style.setProperty(
          "--head-x",
          "0px"
        );

      }, 800 + Math.random() * 1200);
    }

    setTimeout(
      headBehavior,
      2600 +
      Math.random() * 4000
    );
  }

  headBehavior();


  /* ==========================================
     RANDOM MOODS
  ========================================== */

  function randomMood() {

    if (
      !busy &&
      !flying
    ) {

      const mood =
        Math.random();

      if (mood < .25) {

        kukko.classList.add(
          "curious"
        );

        say(
          "HMMMM...",
          1300
        );

        setTimeout(() => {
          kukko.classList.remove(
            "curious"
          );
        }, 1400);

      } else if (mood < .5) {

        kukko.classList.add(
          "happy"
        );

        say(
          "KUKKO IS HAPPY! 😄",
          1600
        );

        setTimeout(() => {
          kukko.classList.remove(
            "happy"
          );
        }, 1800);

      } else if (mood < .75) {

        kukko.classList.add(
          "attitude"
        );

        say(
          "I'M THE BOSS.",
          1700
        );

        setTimeout(() => {
          kukko.classList.remove(
            "attitude"
          );
        }, 1800);

      } else {

        say(
          phrases[
            Math.floor(
              Math.random() *
              phrases.length
            )
          ],
          1800
        );
      }
    }

    setTimeout(
      randomMood,
      8500 +
      Math.random() * 9000
    );
  }

  setTimeout(
    randomMood,
    7000
  );


  /* ==========================================
     TYPING DETECTION
  ========================================== */

  document.addEventListener(
    "keydown",
    e => {

      if (
        e.ctrlKey ||
        e.altKey ||
        e.metaKey ||
        e.key.length !== 1
      ) {
        return;
      }

      const now =
        Date.now();

      if (
        now - lastTyping <
        9000
      ) {
        return;
      }

      lastTyping = now;

      if (
        Math.random() >
        .20
      ) {
        return;
      }

      const active =
        document.activeElement;

      let tx = mouseX;
      let ty = mouseY;

      if (active) {

        const rect =
          active.getBoundingClientRect();

        if (
          rect.width > 0 &&
          rect.height > 0
        ) {

          tx =
            rect.left +
            rect.width / 2;

          ty =
            rect.top - 80;
        }
      }

      say(
        typingPhrases[
          Math.floor(
            Math.random() *
            typingPhrases.length
          )
        ],
        2200
      );

      setTarget(
        tx - 60,
        ty - 70
      );
    },
    true
  );


  /* ==========================================
     CLICK REACTION
  ========================================== */

  kukko.style.pointerEvents =
    "auto";

  kukko.addEventListener(
    "click",
    e => {

      e.stopPropagation();

      kukko.classList.add(
        "excited"
      );

      say(
        "HEY! DON'T POKE ME! 😤",
        1800
      );

      const angle =
        Math.random() *
        Math.PI *
        2;

      setTarget(
        x +
        Math.cos(angle) *
        280,

        y +
        Math.sin(angle) *
        220,

        true
      );

      setTimeout(() => {

        kukko.classList.remove(
          "excited"
        );

      }, 1200);
    }
  );


  /* ==========================================
     BEAK TALKING LOOP
  ========================================== */

  function talkAnimation() {

    if (talking) {

      const amount =
        .55 +
        Math.random() *
        .45;

      kukko.style.setProperty(
        "--beak-open",
        amount
      );
    } else {

      kukko.style.setProperty(
        "--beak-open",
        0
      );
    }

    setTimeout(
      talkAnimation,
      90 + Math.random() * 80
    );
  }

  talkAnimation();


  /* ==========================================
     RESIZE
  ========================================== */

  window.addEventListener(
    "resize",
    () => {

      x = Math.min(
        x,
        window.innerWidth - 180
      );

      y = Math.min(
        y,
        window.innerHeight - 220
      );
    }
  );

})();