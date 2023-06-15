<script setup>
import { useQuasar } from "quasar";
import CounterBox from "src/components/attack/CounterBox.vue";
import { useConfigStore } from "src/stores/config";
import { usePlayer1Store, usePlayer2Store } from "src/stores/players";

const $q = useQuasar();

const settings = useConfigStore();
const player1 = usePlayer1Store();
const player2 = usePlayer2Store();
const nextZone = { high: "mid", mid: "low", low: "high" };
function goNextZone() {
  settings.zone = nextZone[settings.zone];
}
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
        <CounterBox
          @up="player1.starting_health++"
          @down="player1.starting_health--"
        >
          <!-- TODO: refactor player handling, the name being in a separate config is just one of the bad code smells -->
          <h5>
            {{ settings.p1name }} starting health: {{ player1.starting_health }}
          </h5>
        </CounterBox>
        <q-btn
          push
          stack
          size="m"
          icon="restore_page"
          color="negative"
          @click="player1.reset()"
          >Reset {{ settings.p1name }} health ({{ player1.health }})
        </q-btn>
        <q-input
          v-model.string="settings.p2name"
          label="Player 2"
          stack-label
          :rules="[(val) => val.length <= 15 || 'Maximum length 15']"
        />
        <CounterBox
          @up="player2.starting_health++"
          @down="player2.starting_health--"
        >
          <h5>
            {{ settings.p2name }} starting health: {{ player2.starting_health }}
          </h5>
        </CounterBox>
      </div>
      <q-btn
        push
        stack
        size="m"
        icon="restore_page"
        color="negative"
        @click="player2.reset()"
        >Reset {{ settings.p2name }} health ({{ player2.health }})
      </q-btn>
      <div>
        <h6>Attack default</h6>
        <CounterBox
          class="speed"
          :class="settings.zone"
          @up="settings.speed++"
          @down="settings.speed--"
        >
          <h3>{{ settings.speed }}</h3>
        </CounterBox>
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
      </div>
    </div>
  </div>
</template>
