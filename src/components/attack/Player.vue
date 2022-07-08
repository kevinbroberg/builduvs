<script setup>
    import { ref, watch } from 'vue'
    import { hiOrLow } from "src/js/hiorlowlogic"
    
    const props = defineProps({ start: Number, damage: Number, reset: Boolean, label: String })
    const emitChangeLabel = 'healthChange'
    const emit = defineEmits( ['healthChange'] )

    function half(x) {
        return (x % 2) + (x/2 | 0)
    }
    
    const p1 = ref({
        health : props.start
    })
    
    const damageQueue = []

    function hit(x) {
      damageQueue.push(x)
      p1.value.health -= x
      emit(emitChangeLabel, -x)
    }

    function undo() {
      if (damageQueue.length > 0) {
        let y = damageQueue.pop()
        p1.value.health += y
        emit(emitChangeLabel, y)
      }
    }

    watch(() => props.start, (newv, _) => p1.value.health = newv)

    function resetGame() {
      p1.value.health = props.start
      damageQueue.length = 0 // wtf javascript this is such a sussy way to clear an array
    }
    // on ANY change, reset to full life. i think this is an antipattern but idk
    watch(() => props.reset, (_, __) => resetGame())
    
</script>


<template>
  <div>
    <div class="row" > 
      <div @click="hiOrLow($event, () => hit(-1), () => hit(1))" 
        style="border: 2px solid red;" class="col-6">
        <h2 class="q-mx-none self-center text-weight-bold text-center">{{p1.health}}</h2>
        <!-- <p class="q-mx-none self-center text-weight-bold text-center">{{label}}</p> -->
      </div>
      <q-btn push class="col-2" color=green-12 text-color=black @click="hit(half(props.damage))">Take half</q-btn>
      <q-btn push class="col-2" color=purple-12 text-color=black @click="hit(props.damage)">Take full</q-btn>
      <q-btn push class="col-2" text-color=black @click="undo()">Undo</q-btn>
    </div>
  </div>
</template>