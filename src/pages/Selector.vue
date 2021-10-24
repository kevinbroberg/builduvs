<script setup>
  import { ref, computed, defineProps, defineEmits } from "vue"

  const props = defineProps( { picks: Array, options: Array } )
  const picks = ref(props.picks)
  const color = "deep-orange-"
  const emit = defineEmits( [ "update:picks" ] )
  console.log(picks.value)
  const btnOn = {
    color: "deep-orange-10",
    click: (sym) => {
      picks.value.splice(picks.value.indexOf(sym), 1)
      emit("update:picks", picks.value)
    }
  }

  const btnOff = {
    color: "blue-grey-3",
    click: function(sym) {
      picks.value.push(sym)
      emit("update:picks", picks.value)
    }
  }

  // holy shit it's hard to go from an array to a dictionary.
  // python: {option: (option in picks) for option in options}
  // in other words - make a lookup table from "option" -> "is this option selected"
  const state = computed(() => props.options.reduce(
    (accumulate, opt) => ({...accumulate, [opt]: picks.value.includes(opt)}), {}
  ))
</script>

<template>
 <q-btn-group push spread>
  <q-btn v-for="opt, in options" v-bind:key=opt push class="text-black text-capitalize"
    :color="(state[opt] ? btnOn : btnOff).color"
    @click="(state[opt] ? btnOn : btnOff).click(opt)" >
    <slot :selected=opt>{{opt}}</slot>
    <q-separator horizontal />
  </q-btn>
</q-btn-group>
</template>