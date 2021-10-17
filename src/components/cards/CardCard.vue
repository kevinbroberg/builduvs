<script setup>
  import { ref } from 'vue'
  import { useStore } from 'vuex'
  const props = defineProps({ card: Object })
  const data = ref(props.card)
  
  const store = useStore()
  const increment = ev => store.commit('deck/increment', ev)
  const decrement = ev => store.commit('deck/decrement', ev)
  const side = ev => store.commit('deck/send2Board', ev)
</script>

<template>
<q-card style="max-width: 250px" >
    <!-- <q-card-section class="bg-purple text-white"> -->
        <q-img
            loading="lazy"
            fit="cover"
            :src="require('assets/images/card_images/' + data.asset)"
            :alt="data.name">
            <div class="absolute-bottom">
              {{data.qty}} {{data.name}}
            </div>
        </q-img>
    <!-- </q-card-section> -->

    <q-card-actions align="around">
        <q-btn-group push row>
            <!-- @click increment, @click decrement, @click move2Side -->
            <q-btn push col-4 color="positive" @click=increment>+</q-btn> 
            <q-btn push col-4 color="negative" @click=decrement>-</q-btn>
            <q-btn push col-4 color="accent" @click=side>Side</q-btn>
        </q-btn-group>
    </q-card-actions>
</q-card>
</template>