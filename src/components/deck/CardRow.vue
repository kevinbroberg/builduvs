// quasar doesn't style this at all and it sucks :V
<template>
    <q-item :key="card.asset">
    <q-item-section avatar>
        <q-avatar>
        <!-- TODO zoom into just the card art here -->
        <img :src="require(`assets/images/card_images/${card.asset}`)">
        </q-avatar>  
    </q-item-section>
    <q-item-section>
        <q-item-label lines="1">{{card.qty}} {{card.name}}</q-item-label>
    </q-item-section>
    </q-item>
</template>

<script> 
export default {
    props: ["card"]
}
</script>