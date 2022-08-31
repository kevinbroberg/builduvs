<script setup>
    import { ref, watch, computed } from 'vue'
    import { hiOrLow } from "src/js/hiorlowlogic"
    import Counter from 'src/components/attack/Counter.vue'
    
    const props = defineProps({ start: Number, damage: Number, zone: String, reset: Boolean, label: String })
    const emitChangeLabel = 'healthChange'
    const emit = defineEmits( ['healthChange'] )

    function half(x) {
        return (x % 2) + (x/2 | 0)
    }
    
    const p1 = ref({
        health : props.start
    })
    
    const damageQueue = []
    const lastHit = ref(0)
    const lastHitDisplay = computed(() => lastHit.value ? " (" + lastHit.value + ")" : '')

    function hit(x) {
      damageQueue.push(x)
      
      lastHit.value = x

      p1.value.health -= x
      emit(emitChangeLabel, -x)
    }

    function undo() {
      if (damageQueue.length > 0) {
        let y = damageQueue.pop()
        p1.value.health += y
        emit(emitChangeLabel, y)

        lastHit.value = damageQueue.at(-1)
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
    <Counter @up="hit(-1)" @down="hit(1)">
      <h2 class="text-center">{{label}}: {{p1.health}}</h2>
    </Counter>
    <div class="row justify-end">
      <q-btn class="col" push size=xl color=primary text-color=black @click="undo()">Undo {{lastHitDisplay}}</q-btn>
      <q-btn class="col" push size=xl style="background: hsl(360, 100%, 73%)"  text-color=black @click="hit(half(props.damage))">Take half ({{half(props.damage)}})</q-btn>
      <q-btn class="col" push size=xl style="background: hsl(360, 100%, 43%)" text-color=black @click="hit(props.damage)">Take full ({{props.damage}})</q-btn>
    </div>
  </div>
</template>