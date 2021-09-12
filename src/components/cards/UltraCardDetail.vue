<template>
  <q-card
    class="ultra-card row"
    flat
    onmouseover="//preview('$extension', '$padded_numero');"
  >
    <div>
      <q-card-section horizontal class="card_image" @click="increment()">
        <!-- TODO onclick detail popup / dialog / lightbox -->
        <q-img
          :fit="'contain'"
          :loading="'lazy'"
          style="height: 600; width: 300px"
          :src="require('assets/images/card_images/' + this.data.asset)"
          :alt="data.name"
        />
      </q-card-section>
      <q-card-section horizontal>
        <q-card-section>
          <h2>{{ data.name }}</h2>
        </q-card-section>
        <q-card-section class="card_division cd1">
          <Elements v-bind:card="data" />
          {{ data.difficulty }} Difficulty {{ data.control }} Control<br />
          <BlockData v-bind:card="data" />
          <AttackData v-bind:card="data" />
          <div class="ischaracter" v-if="isCharacter()">
            Handsize : {{ data["hand_size"] }} <br />
            Vitality : {{ data["vitality"] }} <br />
          </div>
          <span v-if="myQty > 0" class="badge badge-success"
            >Quantity in Deck {{ myQty }}</span
          >
        </q-card-section>
      </q-card-section>

      <q-card-section class="card_division cd2">
        <!-- TODO onclick detail popup / dialog / lightbox -->
        <h4>{{ (data.keywords ? data.keywords : []).join(" - ") }}</h4>
        <h6>{{ data.text || "Missing text" }}</h6>
        <br />
      </q-card-section>
      <q-card-section class="card-important-info">
        <span class="label" :class="'card-list-' + data.type">{{
          data.type
        }}</span
        ><br />
        {{ data.rarity || "" }}
      </q-card-section>
    </div>
    <div class="clear"></div>
  </q-card>
</template>

<script>
import BlockData from "components/cards/detail/BlockData";
import AttackData from "components/cards/detail/AttackData";
import Elements from "components/cards/detail/Elements";
import { useStore } from "vuex";
import { computed } from "vue";

export default {
  name: "CardDetail",
  components: {
    BlockData,
    AttackData,
    Elements,
  },
  setup(props) {
    const $store = useStore();

    function isCharacter() {
      return props.data["type"] == "character";
    }

    function increment() {
      $store.commit("deck/increment", props.data);
      if (isCharacter()) {
        $store.commit("deck/markMain", props.data);
      }
    }

    function decrement() {
      $store.commit("deck/decrement", props.data);
    }

    const myQty = computed(() => {
        let card = $store.state.deck.deck[props.data.asset];
        return card ? card.qty : 0;
      },
    );

    return {
        increment, decrement, isCharacter, myQty
    }
  },
  props: {
    data: Object,
  },
};
</script>

<style scoped>
.preview {
  max-height: 50;
  display: inline-block;
  margin: auto;
}

.cardstats {
  display: inline-block;
  width: 50;
}

.card-detail {
  background: #f4f4f4;
  padding: 10px;
  border-bottom: 1px #ccc dotted;
}

body {
  font-family: arial;
  background-color: #d9d9d9;
  padding: 0;
  margin: 0;
}

form {
  margin: 0;
}

a {
  color: #555;
}

a:hover {
  color: #222;
}

select {
  width: auto !important;
  height: auto;
  padding: 0 !important;
}

label {
  margin: 0;
  padding-left: 3px;
}

input[type="text"],
input[type="password"] {
  height: 25px;
  margin: 1px;
  padding: 3px;
}

#login,
#password,
#edit_deck_name {
  height: 30px;
  margin: 0;
}

input[type="checkbox"],
input[type="radio"] {
  padding: 0 !important;
  margin: 0 !important;
}

.clear {
  clear: both;
}

.pagination {
  text-align: center;
}

img.full_image {
  max-width: 80;
  max-height: 50;

  vertical-align: bottom;
}

img.mini_image {
  width: 150px;
  height: 210px;
  border-radius: 5px;
  box-shadow: 0 2px 3px #666;
  vertical-align: bottom;
}

img.ci-small_image {
  width: 50px;
  height: 70px;
  float: left;
  border-radius: 3px;
  box-shadow: 0 1px 2px #666;
  vertical-align: bottom;
}

img.ci-micro_image {
  width: 20px;
  height: 20px;
  border-radius: 2px;
  box-shadow: 0 1px 2px #666;
  vertical-align: bottom;
}

.deck-info {
  width: 250px;
  display: inline-block;
}

.deck-info-format {
  cursor: pointer;
}

#content {
  float: left;
}

#preview {
  float: left;
  position: fixed;
  left: 880px;
  bottom: 10px;
}

#preview:hover {
  z-index: 5 !important;
}

#preview-image {
  z-index: -1;
}

#preview ul,
#preview li {
  padding: 0;
  margin: 0;
}

.ultra-card {
  clear: both;
  border: 1px solid #989db3;
  padding-top: 3px;
  /* width : 870px; */
}

.odd {
  background-color: #d9e0ff;
}

.even {
  background-color: #c8cee9;
}

.card:hover {
  background-color: #989db3;
  cursor: pointer;
}

.card_image {
  float: left;
  padding: 3px;
}

.card_infos {
  width: 715px;
  float: left;
}

.card_infos .actions {
  width: 30px;
  padding: 0 !important;
  float: right;
}

.card_infos .actions .btn {
  padding: 4px;
}

.card_infos .actions ul,
.card_infos .actions li {
  margin: 0;
  padding: 0;
  list-style-type: none;
}

.card_infos h1 {
  margin: 0;
}

.card_title {
  width: 100%;
  padding: 10px;
}

.card_division {
  padding: 10px;
  float: left;
}

.cd1 {
  width: 200px;
}

.cd2 {
  width: 360px;
}

.cd3 {
  width: 105px;
  padding: 0;
}

.float_rs {
  display: block;
  float: left;
  width: 95px;
}

.float_rarity {
  display: block;
  float: left;
  margin-right: 3px;
  margin-left: 2px;
}

.float_keyword {
  display: block;
  float: left;
  width: 110px;
}

#search {
  width: 936px;
  margin-left: 5px;
  z-index: 1;
}

#search select {
  height: auto;
  vertical-align: middle;
}

#search select#extension {
  height: 88px;
}

#search_general {
  float: left;
  padding: 5px;
}

#search_infos {
  float: left;
  border-left: 1px solid black;
  padding: 5px 5px 5px 10px;
}

#search_attack {
  float: left;
  border-left: 1px solid black;
  padding: 5px;
  height: 260px;
}

#search_buttons {
  text-align: center;
  margin: auto;
  clear: both;
}

#search_buttons button {
  width: 200px;
}

#search_more {
  display: none;
}

#btn_search_more {
  margin-right: 5px;
  margin-top: 10px;
}

.search-label {
  width: 17%;
  display: inline-block;
  padding-top: 3px;
  padding-bottom: 3px;
}

.search-label-medium {
  width: 30%;
  display: inline-block;
}

.search-label-big {
  width: 40%;
  display: inline-block;
}

.debug {
  display: none;
}

#extension,
#keyword,
#rs {
  height: 64px;
}

#search_general,
#rs_div,
#rarity_div {
  width: 475px;
}

#search_inputs .form-control {
  width: auto !important;
}

#rarity_div strong {
  float: left;
}
#rarity_list {
  margin-left: 60px;
}

#search_infos,
#search_infos #keyword_div,
#block_div {
  width: 440px;
}

#block_div {
  clear: both;
}

input {
  padding: 0;
  margin: 3px 3px 3px 1px;
}

#search a {
  text-decoration: none;
  color: black;
}

/* ICONS */
.report_error {
  /* background : url('../images/icons/report_an_error.png'); */
  display: block;
  width: 16px;
  height: 16px;
  margin: auto;
  margin-bottom: 2px;
}

.set_card {
  /* background : url('../images/icons/set_card.png'); */
  display: block;
  width: 18px;
  height: 24px;
  margin: auto;
  margin-bottom: 2px;
}

.set_card_deck {
  /* background : url('../images/icons/set_card.png') no-repeat scroll right 0; */
  display: inline-block;
  width: 100px;
  height: 24px;
  margin: auto;
  margin-bottom: 2px;
  vertical-align: middle;
}

.edit_card {
  /* background : url('../images/icons/edit.png'); */
  display: block;
  width: 14px;
  height: 16px;
  margin: auto;
}

.edit_deck {
  /* background : url('../images/icons/edit.png'); */
  display: inline-block;
  width: 14px;
  height: 16px;
}

.deck-actions .pull-right {
  margin-right: 15px;
}

.report-card {
  min-height: 80px;
}

.report-card div {
  padding-left: 60px;
}

/* CLUETIP */
.cluetip-inner h4 {
  margin: 0;
  padding: 0;
}

table {
  border: solid 1px #d5d5d5;
  border-collapse: collapse;
}

table td {
  border: 1px solid #d5d5d5;
  font-size: 12px;
  padding: 7px 5px;
}

table tr:hover {
  background-color: #ccc;
  font-weight: bold;
}

table th {
  background-color: #eee;
  border-right: 1px solid #d5d5d5;
  font-size: 13.5px;
  line-height: 120%;
  font-weight: bold;
  padding: 8px 5px;
  text-align: left;
}
.ui-resizable {
  position: relative;
}
.ui-resizable-handle {
  display: block;
  font-size: 0.1px;
  position: absolute;
  z-index: 99999;
}

.ui-resizable-s {
  /* background:#EEEEEE url(../images/grippie.png) no-repeat scroll center 2px; */
  border-top: 1px solid #cccccc;
  bottom: -5px;
  cursor: s-resize;
  height: 14px;
  left: 0;
  width: 100%;
}

/* DECK */

h1 {
  display: inline;
}

.deck-header h2,
.deck-header h4 {
  display: inline;
}

.listing_deck h4 {
  margin-top: 3px;
}

.listing_deck ul,
.listing_deck li {
  list-style-type: none;
  margin: 0;
  padding: 0;
  cursor: pointer;
}

.listing_deck ul {
  padding-left: 2px;
}

.listing_deck {
  width: 750px;
}

.listing_deck div {
  width: 370px;
  padding: 3px 0 3px 3px;
}

.listing_deck h3 {
  padding: 0;
  margin: 0;
  line-height: 25px;
}

.listing_deck_right,
.listing_deck_left {
  float: left;
}

.listing_deck div a {
  color: #cfcfcf;
}

.action {
  display: none;
}

.card-list {
  border: 1px outset graytext;
  border-radius: 4px 4px 4px 4px;
  height: 24px;
  margin: 1px 0 0 !important;
  padding: 0px 3px 0px 3px !important;
  width: 95%;
  line-height: 22px;
  list-style-type: none;
  -moz-box-sizing: content-box !important;
}
.card-list:hover {
  border: 1px inset black;
}
.card-list-onthefly {
  height: 23px;
  margin: 0px 0 0 !important;
  padding: 0px 3px 0px 3px !important;
  width: 357px;
  line-height: 21px;
  list-style-type: none;
  -moz-box-sizing: content-box !important;
  font-size: 13px;
}

.switchPreview {
  text-align: center;
}

.card-important-info {
  float: right;
  margin-right: 0px;
  font-weight: bold;
  font-size: 16px;
  text-align: right;
}

.card-list-character {
  background-color: #485693;
}
.card-list-foundation {
  background-color: #b6a7a0;
}
.card-list-attack {
  background-color: #d25421;
}
.card-list-asset {
  background-color: #a3bf75;
}
.card-list-action {
  background-color: #7e9cc0;
}
.card-list-side {
  background-color: #999999;
}

.card-list .badge,
.card-list-onthefly .badge {
  float: right;
  margin-top: 3px;
}

.actions .badge {
  padding-left: 5px;
  padding-right: 5px;
}

.listing_deck li .set_card_deck {
  float: right;
  height: 24px;
  margin-right: 3px;
  margin-bottom: 0;
}

#preview_listing_deck {
  float: left;
  position: fixed;
  left: 762px;
  top: 35px;
}

h1 a,
h1 .small {
  font-size: 0.4em;
  vertical-align: middle;
}

h1 .icon {
  vertical-align: middle !important;
}

.actions ul li {
  width: 40px;
}

#deck-btn-actions label {
  display: inline-block;
}

#deck-btn-actions {
  display: inline-block;
  vertical-align: middle;
  float: right;
  margin: 0 !important;
}

#deck-btn-actions a,
#deck-btn-actions label,
#deck-btn-actions input {
  font-size: 9pt !important;
  text-align: left;
}

.deck-badges {
  margin-right: 3px;
}

.deck_infos {
  vertical-align: middle;
}

.deck-header {
  margin-left: 10px;
  width: 715px;
  background-color: #bbb;
  border: 1px solid #999;
  border-radius: 5px;
  padding: 5px 10px 5px 10px;
  min-height: 80px;
}

.deck-actions {
  margin-top: 17px;
}

/*.deck-actions .deck-sort-by
{
	display: none;
}*/

.card-list-small {
  font-size: 0.9em;
}

.card-list-xsmall {
  font-size: 0.85em;
}

.deck-sort {
  margin-left: 10px;
  width: 715px;
  padding: 5px 10px 5px 10px;
}

#code_forum {
  height: 300px;
  width: 720px;
}

.avatar-deck {
  float: left;
  width: 280px;
  margin: 0 5px 5px 0;
  border: 1px solid grey;
  border-radius: 3px;
}

.avatar-deck .ci-small_image {
  margin: 1px 3px 1px 1px;
  width: 50px;
  height: 70px;
}

.avatar-deck .img-ci-small {
  width: 50px;
  height: 70px;
}

.avatar-deck-info {
  width: 230px;
}

.avatar-deck-info > span {
  display: block;
  height: 22px;
}

.deck-list {
  margin-left: 5px;
  width: 750px;
}

.deck-list-deck {
  float: left;
  width: 350px;
  margin: 0 5px 5px 0;
  border: 1px solid grey;
  height: 75px;
  background-color: #fff;
  border-radius: 3px;
}

.deck-list-deck-info {
  width: 290px;
  margin-left: 55px;
}

.deck-list-deck .ci-small_image {
  margin-top: 1px;
  margin-left: 1px;
  width: 50px;
  height: 70px;
}

.deck-list-deck-stats {
  display: none;
  position: absolute;
  z-index: 2;
  text-align: right;
  width: 45px;
  height: 55px;
  padding-top: 5px;
}

.deck-list-deck-info > span {
  display: block;
}

.modal-body {
  padding: 5px;
}

.content-block {
  background-color: #f3fafb;
  border: 1px solid rgba(0, 0, 0, 0.3);
  border-radius: 4px 4px 4px 4px;
  padding-bottom: 5px;
  min-height: 20px;
}

.navbar {
  margin-bottom: 5px;
}

.ui-autocomplete {
  max-height: 100px;
  overflow-y: auto;
  /* prevent horizontal scrollbar */
  overflow-x: hidden;
}

.form-proxy fieldset:hover {
  background-color: #ccc;
}

/* PAGINATION */

.pagination {
  margin: 3px 0;
}

#footer {
  clear: both;
  margin-left: 368px;
  padding-top: 20px;
}

#paypal {
  clear: both;
  margin-left: 419px;
  padding-top: 20px;
}

#deck-tabs {
  margin-bottom: 0px;
}

#deck-description-textarea {
  width: 400px;
  height: 150px;
}

.deck-card-format-info {
  display: none;
}

.live-avatar {
  width: 3% !important;
  margin-top: 10px;
}

.live-info {
  margin-left: 0.8% !important;
}

.live-deck-name {
  padding-top: 3px;
}

.avatar-popover-content,
.avatar-popover-title {
  display: none;
}

#deck-comments .deck-comments-hided {
  display: none;
}

.deck-comment p {
  font-weight: normal !important;
  font-size: 14px;
}

#deck-comments .btn-group {
  margin-bottom: 5px;
}

.well .deck-comment-follow blockquote {
  border-color: rgba(0, 0, 0, 0.3) !important;
}

.well .deck-comment-owner blockquote {
  border-color: rgba(0, 0, 0, 0.45) !important;
}

.live-event {
  border-bottom: 1px dotted #aaa;
}

.deck-actions-hided {
  display: none;
}

.live-listing blockquote {
  border-left: 4px solid rgba(0, 0, 0, 0.15);
  font-size: 0.9em;
  padding: 3px 12px;
}

.live-listing blockquote blockquote {
  border-left: 2px solid rgba(0, 0, 0, 0.15);
  padding: 3px 12px;
  margin: 4px 0 4px 0;
}

/* BOOTSTRAP REWRITE */
label {
  font-weight: normal;
}

.btn-sm {
  padding: 3px 5px !important;
}

.modal-body {
  max-height: 500px;
  overflow-y: auto;
}

.badge-error {
  background-color: #b94a48;
}
.badge-error:hover {
  background-color: #953b39;
}
.badge-warning {
  background-color: #f89406;
}
.badge-warning:hover {
  background-color: #c67605;
}
.badge-success {
  background-color: #468847;
}
.badge-success:hover {
  background-color: #356635;
}
.badge-info {
  background-color: #3a87ad;
}
.badge-info:hover {
  background-color: #2d6987;
}
.badge-inverse {
  background-color: #333333;
}
.badge-inverse:hover {
  background-color: #1a1a1a;
}

.navbar-nav > li > a {
  padding-top: 10px !important;
  padding-bottom: 10px !important;
}

.navbar-brand {
  padding: 10px !important;
}

.navbar {
  min-height: 40px !important;
}

.popover-content *,
.popover-content *:before,
.popover-content *:after {
  -moz-box-sizing: initial;
}

.carousel-indicators {
  top: 5px;
  bottom: auto;
}

.carousel-caption {
  position: static;
  color: black;
}

.carousel-indicators li {
  background-color: #999;
}

.carousel-indicators .active {
  background-color: #000;
}

.carousel-inner > .item > img,
.carousel-inner > .item > a > img {
  margin: auto;
}

.ias_loader {
  clear: both;
  text-align: center;
}
</style>
