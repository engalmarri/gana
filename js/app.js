import { db } from "./firebase.js";

import {
collection,
getDocs
}
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

let allProducts = [];

let cart =
JSON.parse(
localStorage.getItem("cart")
) || [];

const productsDiv =
document.getElementById("products");

const searchInput =
document.getElementById("search");

const cartCount =
document.getElementById("cartCount");
/* ==========================
LOAD PRODUCTS
========================== */

async function loadProducts(){

const querySnapshot =
await getDocs(
collection(db,"products")
);

allProducts = [];

querySnapshot.forEach(doc=>{

allProducts.push({
id:doc.id,
...doc.data()
});

});

renderProducts(allProducts);

}

/* ==========================
RENDER PRODUCTS
========================== */
function renderProducts(products){

productsDiv.innerHTML = "";

products.forEach(p=>{

productsDiv.innerHTML += `

<div class="product">

<img
src="${p.image}"
onerror="this.src='https://via.placeholder.com/300'">

<h3>${p.name}</h3>

<p>${p.description || ""}</p>

<p class="sku">

SKU|

${p.code}

</p>
<button
class="cart-btn"
data-id="${p.id}">

🛒 Add To Cart
<br>
إضافة للسلة

</button>

</div>

`;

});

document
.querySelectorAll(".cart-btn")
.forEach(btn=>{

btn.addEventListener("click",()=>{

addToCart(
btn.dataset.id
);

});

});

}

/* ==========================
CART FUNCTIONS
========================== */

function addToCart(id){

const product =
allProducts.find(
p => p.id === id
);

if(!product) return;

const existing =
cart.find(
p => p.id === id
);

if(existing){

existing.qty++;

}else{

cart.push({

id: product.id,

name: product.name || "",

description: product.description || "",

code: product.code || "",

category: product.category || "",

image: product.image || "images/noimg.jpg",

qty: 1

});

}

updateCartCount();

}

function increaseQty(id){

const item =
cart.find(
p => p.id === id
);

if(item){

item.qty++;

updateCartCount();

}

}

function decreaseQty(id){

const item =
cart.find(
p => p.id === id
);

if(!item) return;

item.qty--;

if(item.qty <= 0){

cart =
cart.filter(
p => p.id !== id
);

}

updateCartCount();

}

function deleteItem(id){

cart =
cart.filter(
p => p.id !== id
);

updateCartCount();

}

function saveCart(){

localStorage.setItem(
"cart",
JSON.stringify(cart)
);

renderCart();

}


/* ==========================
GLOBAL
========================== */

window.increaseQty =
increaseQty;

window.decreaseQty =
decreaseQty;

window.deleteItem =
deleteItem;


/* ==========================
SEARCH
========================== */

searchInput
.addEventListener("input",()=>{

const value =
searchInput.value.toLowerCase();

const filtered =
allProducts.filter(p=>

p.name
.toLowerCase()
.includes(value)

);

renderProducts(filtered);

});
/* ==========================
CATEGORY FILTER
========================== */

document
.querySelectorAll(".cat-btn")
.forEach(btn=>{

btn.addEventListener("click",()=>{

const cat =
btn.dataset.cat;

if(cat === "all"){

renderProducts(allProducts);

return;

}

const filtered =
allProducts.filter(product =>

(product.category || "")
.toLowerCase()
.includes(
cat.toLowerCase()
)

);

renderProducts(filtered);

});

});

/* ==========================
CART COUNT
========================== */

function updateCartCount(){

if(!cartCount) return;

cartCount.textContent =
cart.length;

localStorage.setItem(
"cart",
JSON.stringify(cart)
);

}
/* ==========================
START
========================== */

updateCartCount();

loadProducts();
