<script setup>
    import { ref } from 'vue'
    import SimpleTypePicker from 'src/components/filter/SimpleTypePicker.vue'
    
    const props = defineProps({ damage: Number })
    
    function hiOrLow(e, hi, low) {
        var rect = e?.target?.getBoundingClientRect();
        if(!rect) {
            console.log(`sry no bounding rectange, only counting up`)
            hi()
            return 
        }
        // var x = e.clientX - rect.left; //x position within the element. - unused
        var y = e.clientY - rect.top;  //y position within the element.
        var mid = (rect.bottom - rect.top)/2
        // console.log(`Computed ${y} from client ${e.clientY} rect ${rect.top} and relative to ${mid}`);
        // console.log(`do high? ${y < mid}`)
        if(y < mid) {
            hi()
        } else {
            low()
        }
    }
    
    function half(x) {
        return (x % 2) + (x/2 | 0)
    }
    
    const p1 = ref({
        face : null,
        health : 30
    })
    function updatePlayer(choice, player) {
        player.health = choice.vitality
        player.face = choice
    }
</script>


<template>
  <div>
    <SimpleTypePicker :type="'character'" :label="'Select character for Player 1'" @update:choice="updatePlayer($event, p1)" />
    <div class="row" > 
      <div @click="hiOrLow($event, () => p1.health++, () => p1.health--)" 
        style="border: 2px solid red;" class="col-6">
        <h2 class="q-mx-none self-center text-center">{{p1.health}}</h2>  
      </div>
      <q-btn push class="col-2" color=green-12 text-color=black @click="p1.health -= half(props.damage)">Take half</q-btn>
      <q-btn push class="col-2" color=purple-12 text-color=black @click="p1.health -= props.damage">Take full</q-btn>
      <q-btn push class="col-2" text-color=black @click="p1.health = p1.face.vitality">Reset</q-btn>
    </div>
  </div>
</template>