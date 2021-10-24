<template>
  <q-icon :name="'img:' + pic()" />
</template>

<script>
export default {
    name: "Element",
    props: {
      element: String
    },
    methods: {
        pic() {
            return require('assets/images/' + this.switchSource(this.element) + '.png')
        },
        switchSource(s) {
          return s ? s.toLowerCase() : "";
      }
    }
}
</script>