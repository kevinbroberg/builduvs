<script setup>
  import { ref, computed, defineProps, defineEmits } from "vue"

  const props = defineProps( { picks: Array, options: Array, name: String } )
  const picks = ref(props.picks)
  const color = "deep-orange-"
  const emit = defineEmits( [ "update:picks" ] )
  const btnOn = {
    color: "deep-orange-8",
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
 <span class="row">
  <body v-if="props.name" class="col-1">{{props.name}}</body>
  <q-btn-group push spread :class="[props.name ? 'col-11' : 'col-12']">
    <q-btn v-for="opt in options" v-bind:key=opt push class="text-black text-capitalize"
      :color="(state[opt] ? btnOn : btnOff).color"
      @click="(state[opt] ? btnOn : btnOff).click(opt)" >
      <slot :selected=opt>{{opt}}</slot>
      <q-separator horizontal />
    </q-btn>
  </q-btn-group>
</span>
</template>