const SUPABASE_PROJECT_URL = 'https://vepymzxjgyzgbldqgcnf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZlcHltenhqZ3l6Z2JsZHFnY25mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NTQ5NDgsImV4cCI6MjA4MDQzMDk0OH0.2mID1CkDJ60UTxGWEQbTIOj2G9osAMwxeNRHh_e6PHA';
const IMAGE_BASE_URL = `${SUPABASE_PROJECT_URL}/storage/v1/object/public/images/`;

const products = []; // Will be fetched from Supabase

async function fetchProducts() {
    try {
        const response = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/products?select=*&order=id`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const data = await response.json();
        if (data) {
            // Update the global products array
            products.length = 0; // Clear existing
            products.push(...data);

            // Re-render if product container exists (Shop or Home)
            if (productsContainer) {
                renderProducts();
            }

            // Re-render if on product detail page
            if (window.location.pathname.includes('product.html')) {
                renderProductDetail();
            }
        }
    } catch (error) {
        console.error('Error fetching products:', error);
    }
}

// Call fetchProducts on load
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    // ... existing init code
});


// Currency Logic
let exchangeRates = {
    'EUR': { rate: 1, symbol: '€' },
    'USD': { rate: 1.05, symbol: '$' },
    'GBP': { rate: 0.83, symbol: '£' },
    'CHF': { rate: 0.93, symbol: 'CHF ' }
};

async function fetchExchangeRates() {
    try {
        const response = await fetch(`${SUPABASE_PROJECT_URL}/rest/v1/exchange_rates?select=*`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        const data = await response.json();

        if (data) {
            data.forEach(row => {
                let symbol = '';
                if (row.currency === 'EUR') symbol = '€';
                else if (row.currency === 'USD') symbol = '$';
                else if (row.currency === 'GBP') symbol = '£';
                else if (row.currency === 'CHF') symbol = 'CHF ';

                exchangeRates[row.currency] = { rate: row.rate, symbol: symbol };
            });

            // Re-render to reflect new rates
            renderProducts();
            renderProductDetail();
            renderCart();
            // Re-inject selector in case new currencies were added
            injectCurrencySelector();
        }
    } catch (error) {
        console.error('Error fetching exchange rates:', error);
    }
}

let currentCurrency = localStorage.getItem('oblivCurrency') || 'EUR';

function setCurrency(currency) {
    currentCurrency = currency;
    localStorage.setItem('oblivCurrency', currency);
    // Re-render everything
    renderProducts();
    renderProductDetail();
    renderCart();
    updateCurrencySelector();
}

function formatPrice(priceInEur) {
    const currency = exchangeRates[currentCurrency];
    const converted = priceInEur * currency.rate;
    return `${currency.symbol}${converted.toFixed(2)}`;
}

function injectCurrencySelector() {
    const footer = document.querySelector('footer');
    // Remove old selector if it exists
    const oldSelector = document.getElementById('currency-custom-container');
    if (oldSelector) oldSelector.remove();

    if (footer && !document.getElementById('currency-custom-container')) {
        const container = document.createElement('div');
        container.id = 'currency-custom-container';
        container.className = 'currency-custom-container';

        const label = document.createElement('span');
        label.className = 'currency-label';
        label.innerText = 'Currency: ';

        const currentDisplay = document.createElement('span');
        currentDisplay.id = 'currency-current-display';
        currentDisplay.className = 'currency-current-display';
        currentDisplay.innerText = currentCurrency;

        const dropdown = document.createElement('div');
        dropdown.className = 'currency-custom-dropdown';

        Object.keys(exchangeRates).forEach(curr => {
            const option = document.createElement('div');
            option.className = 'currency-custom-option';
            option.innerText = curr;
            option.onclick = () => {
                setCurrency(curr);
            };
            dropdown.appendChild(option);
        });

        container.appendChild(label);
        container.appendChild(currentDisplay);
        container.appendChild(dropdown);

        // Toggle menu on click (for mobile)
        container.onclick = (e) => {
            e.stopPropagation();
            container.classList.toggle('active');
        };

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                container.classList.remove('active');
            }
        });

        // Insert before footer-right to place it in the center (assuming footer has left and right children)
        const footerRight = footer.querySelector('.footer-right');
        if (footerRight) {
            footer.insertBefore(container, footerRight);
        } else {
            footer.appendChild(container);
        }
    }
}

function updateCurrencySelector() {
    const display = document.getElementById('currency-current-display');
    if (display) display.innerText = currentCurrency;
}

// Cart Logic
let cart = JSON.parse(localStorage.getItem('oblivCart')) || [];

// Fix for stale images in cart (Migration from local to Supabase)
cart = cart.map(item => {
    if (item.image && !item.image.startsWith('http')) {
        // Assume it's a local path like "images/hoodie1.png"
        const filename = item.image.split('/').pop();
        return {
            ...item,
            image: `${IMAGE_BASE_URL}${filename}`
        };
    }
    return item;
});
localStorage.setItem('oblivCart', JSON.stringify(cart));

function updateCartCount() {
    const countSpan = document.getElementById('cart-count');
    if (countSpan) {
        countSpan.innerText = cart.length;
    }
}

function addToCart(productId) {
    const sizeInput = document.getElementById('selected-size-input');
    let selectedSize = null;
    let variantId = null;

    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product.variants) {
        // Product has sizes
        if (sizeInput && sizeInput.value) {
            selectedSize = sizeInput.value;
            variantId = product.variants[selectedSize];
        } else {
            // No size selected
            alert("Please select a size.");
            return;
        }
    } else {
        // Product has no sizes (e.g., Bag)
        selectedSize = "One Size";
        variantId = product.printfulVariantId; // Might be undefined if not in DB variants json, but we handle it
    }

    if (product) {
        cart.push({
            ...product,
            image: product.images[0], // Use first image for cart
            selectedSize: selectedSize,
            printfulVariantId: variantId // Optional now, backend handles it if needed, or we just order by product ID
        });
        localStorage.setItem('oblivCart', JSON.stringify(cart));
        updateCartCount();
        alert(`${product.name} ${selectedSize !== "One Size" ? `(${selectedSize}) ` : ""}added to cart!`);
    } else {
        alert("Please select a size.");
    }
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('oblivCart', JSON.stringify(cart));
    updateCartCount();
    renderCart(); // Re-render cart page
}

// Page Rendering
const productsContainer = document.getElementById('products-container');
const cartItemsContainer = document.getElementById('cart-items-container');
const cartSummary = document.getElementById('cart-summary');
const emptyCartMsg = document.getElementById('empty-cart-msg');
const cartTotalSpan = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const productDetailContainer = document.getElementById('product-detail-container');

// Gallery State
let currentProduct = null;
let currentImageIndex = 0;

function changeImage(direction) {
    console.log('changeImage called', direction);
    if (!currentProduct || !currentProduct.images || currentProduct.images.length <= 1) {
        console.log('No multiple images to cycle');
        return;
    }

    currentImageIndex += direction;

    // Wrap around
    if (currentImageIndex < 0) {
        currentImageIndex = currentProduct.images.length - 1;
    } else if (currentImageIndex >= currentProduct.images.length) {
        currentImageIndex = 0;
    }

    const mainImage = document.getElementById('main-product-image');
    if (mainImage) {
        mainImage.src = currentProduct.images[currentImageIndex];
    }
}
// Ensure global access
window.changeImage = changeImage;

function renderProducts() {
    if (!productsContainer) return;
    productsContainer.innerHTML = products.map(product => `
        <div class="product-card" onclick="window.location.href='product.html?id=${product.id}'">
            <div class="product-image-container">
                <img src="${product.images[0]}" alt="${product.name}" class="product-image">
            </div>
            <h3 class="product-title">${product.name}</h3>
            <p class="product-price">${formatPrice(product.price_eur || product.price)}</p>
        </div>
    `).join('');
}

function renderProductDetail() {
    if (!productDetailContainer) return;

    const urlParams = new URLSearchParams(window.location.search);
    const productId = parseInt(urlParams.get('id'));
    const product = products.find(p => p.id === productId);

    if (!product) {
        productDetailContainer.innerHTML = '<p>Product not found.</p>';
        return;
    }

    // Set global state
    currentProduct = product;
    currentImageIndex = 0;

    // Size Selector HTML (Buttons instead of dropdown)
    let sizeSelectorHtml = '';
    if (product.variants) {
        sizeSelectorHtml = `
            <div class="size-selector-container">
                <span class="size-label">Select Size</span>
                <div class="size-options">
                    ${Object.keys(product.variants).map(size => `
                        <button class="size-btn" onclick="selectSize(this, '${size}')">${size}</button>
                    `).join('')}
                </div>
                <input type="hidden" id="selected-size-input" value="">
            </div>
        `;
    }

    // Image Gallery HTML
    let arrowsHtml = '';
    if (product.images && product.images.length > 1) {
        arrowsHtml = `
            <button class="nav-arrow left-arrow" onclick="changeImage(-1)">&lt;</button>
            <button class="nav-arrow right-arrow" onclick="changeImage(1)">&gt;</button>
        `;
    }

    const mainImageHtml = `
        <div class="main-image-wrapper">
            ${arrowsHtml}
            <img id="main-product-image" src="${product.images ? product.images[0] : product.image}" alt="${product.name}">
        </div>
    `;

    let thumbnailsHtml = '';
    if (product.images && product.images.length > 1) {
        thumbnailsHtml = `<div class="thumbnails-container">
            ${product.images.map((img, index) => `
                <img src="${img}" 
                     onclick="currentImageIndex = ${index}; document.getElementById('main-product-image').src = '${img}'" 
                     class="thumbnail-img"
                >
            `).join('')}
        </div>`;
    }

    productDetailContainer.innerHTML = `
        <div class="product-detail-left">
            ${mainImageHtml}
            ${thumbnailsHtml}
        </div>
        <div class="product-detail-right">
            <h1 class="pd-title">${product.name}</h1>
            <p class="pd-price">${formatPrice(product.price_eur || product.price)}</p>
            
            ${sizeSelectorHtml}

            <div class="pd-description">
                ${product.description}
            </div>
            <button class="add-to-cart-btn" onclick="addToCart(${product.id})">Add to Cart</button>
        </div>
    `;
}

// Helper for size selection
function selectSize(btn, size) {
    // Remove active class from all buttons
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    // Add active class to clicked button
    btn.classList.add('active');
    // Set hidden input value
    const input = document.getElementById('selected-size-input');
    if (input) input.value = size;
}
// Ensure global access
window.selectSize = selectSize;

function renderCart() {
    if (!cartItemsContainer) return;

    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '';
        cartSummary.style.display = 'none';
        emptyCartMsg.style.display = 'block';
        return;
    }

    emptyCartMsg.style.display = 'none';
    cartSummary.style.display = 'block';

    let total = 0;
    cartItemsContainer.innerHTML = cart.map((item, index) => {
        total += (item.price_eur || item.price); // Base price in EUR
        return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid #333;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <img src="${item.image}" alt="${item.name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 50%;">
                    <div>
                        <h4 style="font-size: 1.1rem;">${item.name} <span style="font-size: 0.8rem; color: #888;">(${item.selectedSize})</span></h4>
                        <p style="color: #888;">${formatPrice(item.price_eur || item.price)}</p>
                    </div>
                </div>
                <button onclick="removeFromCart(${index})" style="background: none; border: none; color: #ff4444; cursor: pointer;">Remove</button>
            </div>
        `;
    }).join('');

    // Convert total
    const currency = exchangeRates[currentCurrency];
    const convertedTotal = total * currency.rate;
    cartTotalSpan.innerText = `${currency.symbol}${convertedTotal.toFixed(2)}`;
}

async function initiateCheckout() {
    if (cart.length === 0) return;

    const originalText = checkoutBtn.innerText;
    checkoutBtn.innerText = "Processing...";
    checkoutBtn.disabled = true;

    try {
        const items = cart.map(item => ({
            id: item.id,
            quantity: 1,
            size: item.selectedSize
        }));

        const response = await fetch(`${SUPABASE_PROJECT_URL}/functions/v1/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({
                items,
                currency: currentCurrency.toLowerCase(), // Send selected currency
                return_url: window.location.href.split('?')[0]
            })
        });

        const data = await response.json();

        if (data.url) {
            window.location.href = data.url;
        } else {
            console.error('Checkout Error:', data);
            alert(`Error creating checkout session: ${data.error || JSON.stringify(data)}`);
            checkoutBtn.innerText = originalText;
            checkoutBtn.disabled = false;
        }
    } catch (error) {
        console.error('Network/Script Error:', error);
        alert(`Something went wrong: ${error.message}`);
        checkoutBtn.innerText = originalText;
        checkoutBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchProducts();
    fetchExchangeRates();
    injectCurrencySelector();
    updateCartCount();
    renderProducts();
    renderProductDetail();
    renderCart();

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', initiateCheckout);
    }
});
