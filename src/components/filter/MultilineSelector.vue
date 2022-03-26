<script setup>
  import { ref, computed, defineProps, defineEmits, watch } from "vue"

  const props = defineProps( { picks: Array, options: Array, name: String, multi: Number } )
  const picks = ref(props.picks)
  // TODO? I'm sure I'm doing something wrong to need to monkeypatch this
  watch(props, (nv, _) => {
    // console.log(`watching props ${nv.picks} ${_.picks}`)
    picks.value = nv?.picks
  })
  
  /**
   * Returns an array starting at 0 with length n containing sequential numbers
   * upTo(4) = [0, 1, 2, 3]
   */
  function upTo(n) {
    return [...Array(n).keys()]
  }
  
  const lines = props.multi || 2
  const len = Math.floor(props.options.length / lines)
  let groups = upTo(lines).map(i => props.options.slice(len*i, len*(i+1)))

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

  // holy shit it's hard to go from an array to a dictionary. key->boolean
  // python: {option: (option in picks) for option in options}
  // in other words - make a lookup table from "option" -> "is this option selected"
  const state = computed(() => props.options.reduce(
    (accumulate, option) => ({...accumulate, [option]: picks.value.includes(option)}), {}
  ))
</script>

<template>
  <span class="row" v-for="(group, i) in groups" v-bind:key=i>
    <slot name="label"><body v-if="props.name && i == 0" class="col-1">{{props.name}}</body></slot>
    <q-btn-group push spread :class="[props.name && i == 0 ? 'col-11' : 'col-12']">
      <q-btn v-for="option in group" v-bind:key=option push class="text-black text-capitalize"
        :color="(state[option] ? btnOn : btnOff).color"
        @click="(state[option] ? btnOn : btnOff).click(option)" >
        <slot name="button" :selected=option>{{option}}</slot>
      </q-btn>
    </q-btn-group>
  </span>
</template>