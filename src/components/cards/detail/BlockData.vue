<template>
<div class="hasblock" v-if="rawzone">
  <span>
    Block : +{{card['block_modifier']}} <ResourceSymbol element="card.block_zone" isBlockSymbol /> <br/>
  </span>
</div>
</template>

<script>
import ResourceSymbol from "./ResourceSymbol.vue"
export default {
    components: { ResourceSymbol },
    name: "BlockDisplay",
    props: {
      card: Object
    }
}
</script>