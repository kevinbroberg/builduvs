<script setup>
import { useQuasar } from "quasar";
import { ref, watch } from "vue";
import CounterBox from "src/components/attack/CounterBox.vue";

const $q = useQuasar();

const storage_key = "attack_default";
const default_defaults = {
  speed: 4,
  damage: 5,
  zone: "mid",
  p1hp: 30,
  p1name: "Me",
  p2hp: 30,
  p2name: "You",
};
const initial_defaults =
  $q.localStorage?.getItem(storage_key) || default_defaults;

const settings = ref(initial_defaults);

const nextZone = { high: "mid", mid: "low", low: "high" };
function goNextZone() {
  settings.value.zone = nextZone[settings.value.zone];
}

watch(
  settings,
  (nu, _) => {
    try {
      $q.localStorage.set(storage_key, nu);
    } catch (e) {
      console.log(`Error persisting settings ${e}`);
    }
  },
  { deep: true }
);
</script>

<template>
  <div class="q-pa-md">
    <div class="q-gutter-md" style="max-width: 300px">
      <div class="text-h6">
        Players
        <q-input
          v-model.string="settings.p1name"
          label="Player 1"
          stack-label
          :rules="[(val) => val.length <= 15 || 'Maximum length 15']"
        />
        <CounterBox @up="settings.p1hp++" @down="settings.p1hp--">
          <h5>{{ settings.p1name }} starting health: {{ settings.p1hp }}</h5>
        </CounterBox>

        <q-input
          v-model.string="settings.p2name"
          label="Player 2"
          stack-label
          :rules="[(val) => val.length <= 15 || 'Maximum length 15']"
        />
        <CounterBox @up="settings.p2hp++" @down="settings.p2hp--">
          <h5>{{ settings.p2name }} starting health: {{ settings.p2hp }}</h5>
        </CounterBox>
      </div>
      <div>
        <h6>Attack default</h6>
        <main>
          <CounterBox
            class="speed"
            :class="settings.zone"
            @up="settings.speed++"
            @down="settings.speed--"
          >
            <h3>{{ settings.speed }}</h3>
          </CounterBox>
          <!-- TODO sometime soon: replace with divs rather than click3() function -->
          <div
            class="zone text-center"
            :class="`${settings.zone}color`"
            @click="goNextZone"
          >
            <h4 class="q-mx-none">
              {{ settings.zone }}
            </h4>
          </div>
          <CounterBox
            class="damage"
            @up="settings.damage++"
            @down="settings.damage--"
          >
            <h3>{{ settings.damage }}</h3>
          </CounterBox>
        </main>
        <p>
          The floating reset button will set the current attack to these values
        </p>
      </div>
    </div>
  </div>
</template>
<style>
.player {
  /* I'd really think player{} should work... */
  grid-column: span 3 / auto;
  padding: 0.5ch;
}
.speed {
  /* padding: 2vh;  */
  border: 0.5ch solid black;
  grid-column: span 2 / auto;
}
.zone {
  border: 0.5ch solid black;
  grid-column: span 1;
}
.speed,
.damage,
.high,
.mid,
.low {
  background-repeat: no-repeat;
  background-size: contain;
  background-position: 50% center;
  display: flex;
  flex-direction: column;
}
.high,
.mid,
.low {
  background-position: 55% center;
}
.damage {
  /* padding: 2vh;  */
  border: 0.5ch solid black;
  background-image: url("assets/damage.png");
  grid-column: span 3 / auto;
}
.lowcolor {
  background-color: hsl(53, 91%, 55%);
}
.highcolor {
  background-color: hsl(359, 85%, 53%);
}
.midcolor {
  background-color: hsl(28, 93%, 58%);
}
.high {
  background-image: url("assets/high attack.png");
}
.mid {
  background-image: url("assets/mid attack.png");
}
.low {
  background-image: url("assets/low attack.png");
}

main {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  /* changed from copy-pasted */
  /* grid-template-rows: 40vh 40vh; */
  justify-content: center;
  align-items: center;
  user-select: none; /* don't highlight text */
  box-sizing: border-box;
}
</style>
