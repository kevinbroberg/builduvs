<script setup>
import { useQuasar } from "quasar";
import CounterBox from "src/components/attack/CounterBox.vue";
import { useGameStore } from "src/stores/game";

const $q = useQuasar();

const game = useGameStore();
const nextZone = { high: "mid", mid: "low", low: "high" };
function goNextZone() {
  game.setDefaultZone(nextZone[game.defaultZone]);
}
</script>

<template>
  <div class="q-pa-md config-page">
    <div class="text-h5 q-mb-md">Game settings</div>

    <div class="row q-col-gutter-md q-mb-md">
      <!-- Player 1 -->
      <div class="col-12 col-sm-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-overline">Player 1</div>
            <q-input
              :model-value="game.player1.name"
              @update:model-value="game.setPlayer1Name"
              label="Name"
              stack-label
              dense
              :rules="[(val) => val.length <= 15 || 'Maximum length 15']"
            />
          </q-card-section>

          <q-card-section>
            <CounterBox
              @up="game.incrementPlayer1StartingHealth()"
              @down="game.decrementPlayer1StartingHealth()"
            >
              <div class="text-h4 text-center q-pa-sm">
                {{ game.player1.startingHealth }}
              </div>
              <div class="text-caption text-center">Starting health</div>
            </CounterBox>
          </q-card-section>

          <q-card-actions>
            <q-btn
              push
              no-caps
              icon="restore_page"
              color="negative"
              class="full-width"
              @click="game.resetPlayer1()"
            >
              Reset health ({{ game.player1.health }})
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>

      <!-- Player 2 -->
      <div class="col-12 col-sm-6">
        <q-card flat bordered>
          <q-card-section>
            <div class="text-overline">Player 2</div>
            <q-input
              :model-value="game.player2.name"
              @update:model-value="game.setPlayer2Name"
              label="Name"
              stack-label
              dense
              :rules="[(val) => val.length <= 15 || 'Maximum length 15']"
            />
          </q-card-section>

          <q-card-section>
            <CounterBox
              @up="game.incrementPlayer2StartingHealth()"
              @down="game.decrementPlayer2StartingHealth()"
            >
              <div class="text-h4 text-center q-pa-sm">
                {{ game.player2.startingHealth }}
              </div>
              <div class="text-caption text-center">Starting health</div>
            </CounterBox>
          </q-card-section>

          <q-card-actions>
            <q-btn
              push
              no-caps
              icon="restore_page"
              color="negative"
              class="full-width"
              @click="game.resetPlayer2()"
            >
              Reset health ({{ game.player2.health }})
            </q-btn>
          </q-card-actions>
        </q-card>
      </div>
    </div>

    <!-- Attack defaults -->
    <q-card flat bordered>
      <q-card-section>
        <div class="text-h6">Attack defaults</div>
      </q-card-section>
      <q-card-section>
        <div class="row q-col-gutter-md items-center">
          <div class="col-4">
            <CounterBox
              class="speed"
              :class="game.defaultZone"
              @up="game.incrementDefaultSpeed()"
              @down="game.decrementDefaultSpeed()"
            >
              <h3 class="q-ma-none text-center">{{ game.defaultSpeed }}</h3>
            </CounterBox>
          </div>
          <div class="col-4">
            <div
              class="zone text-center"
              :class="`${game.defaultZone}color`"
              @click="goNextZone"
              style="cursor: pointer"
            >
              <h4 class="q-ma-none">{{ game.defaultZone }}</h4>
            </div>
          </div>
          <div class="col-4">
            <CounterBox
              class="damage"
              @up="game.incrementDefaultDamage()"
              @down="game.decrementDefaultDamage()"
            >
              <h3 class="q-ma-none text-center">{{ game.defaultDamage }}</h3>
            </CounterBox>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </div>
</template>

<style scoped>
.config-page {
  max-width: 700px;
  margin: 0 auto;
}
</style>
