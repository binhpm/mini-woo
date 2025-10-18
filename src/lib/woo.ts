interface OrderInfo {
    name?: string;
    email?: string;
    phone_number?: string;
    shipping_address?: {
        street_line1?: string;
        street_line2?: string;
        city?: string;
        state?: string;
        country_code?: string;
        post_code?: string;
    };
}

interface WooCommerceOrder {
    id: number;
    order_key: string;
    currency: string;
    payment_method: string;
    line_items: Array<{
        name: string;
        quantity: number;
        total: string;
    }>;
}

const WOOCOMMERCE_URL = process.env.WOOCOMMERCE_URL!!
const CONSUMER_KEY = process.env.WOOCOMMERCE_CONSUMER_KEY!!
const CONSUMER_SECRET = process.env.WOOCOMMERCE_CONSUMER_SECRET!!

interface ShippingInfo {
    name: string;
    email?: string;
    phone?: string;
    address: {
        street_line1: string;
        street_line2?: string;
        city: string;
        state?: string;
        country_code: string;
        post_code: string;
    };
}

function put(api: string, body: any, query?: URLSearchParams) {
    return call("PUT", api, query, body);
}

function post(api: string, body: any, query?: URLSearchParams) {
    return call("POST", api, query, body);
}

function get(api: string, query?: URLSearchParams) {
    return call("GET", api, query, undefined)
}

function call(method: string, api: string, query?: URLSearchParams, body?: any) {
    const headers = {
        "Content-Type": "application/json"
    };

    let url = `${WOOCOMMERCE_URL}/wp-json/wc/v3/${api}`.replace("//", "/");
    if (!query)
        query = new URLSearchParams()
    query.set("consumer_secret", CONSUMER_SECRET);
    query.set("consumer_key", CONSUMER_KEY);
    url = url + "?" + query.toString();
    if (body)
        body = JSON.stringify(body)

    let init = {body, method, headers};

    console.log(`Proxy woo: ${url} | ${JSON.stringify(init)}`);

    return fetch(url, init);
}

async function createOrder(line_items: any[], customer_note: string, payment_method: string = 'prepayment', metadata?: { username?: string }): Promise<WooCommerceOrder> {
    const body = {
        "set_paid": false,
        line_items,
        customer_note,
        payment_method,
        payment_method_title: payment_method === 'prepayment' ? 'Prepayment' : 'Telegram Payment',
        meta_data: metadata?.username ? [
            {
                key: 'telegram_username',
                value: metadata.username // Remove @ prefix as it's already clean from the context provider
            }
        ] : undefined
    }
    const res = await post("orders", body)
    return await res.json()
}

function updateOrder(orderId: number, update: any) {
    return put(`orders/${orderId}`, update)
}

function updateOrderInfo(orderId: number, shippingInfo: ShippingInfo) {
    const update = {
        shipping: {
            first_name: shippingInfo.name.split(' ')[0] || shippingInfo.name,
            last_name: shippingInfo.name.split(' ').slice(1).join(' ') || shippingInfo.name,
            company: '',
            address_1: shippingInfo.address.street_line1,
            address_2: shippingInfo.address.street_line2 || '',
            city: shippingInfo.address.city,
            state: shippingInfo.address.state || '',
            postcode: shippingInfo.address.post_code,
            country: shippingInfo.address.country_code,
            email: shippingInfo.email || '',
            phone: shippingInfo.phone || ''
        },
        billing: {
            first_name: shippingInfo.name.split(' ')[0] || shippingInfo.name,
            last_name: shippingInfo.name.split(' ').slice(1).join(' ') || shippingInfo.name,
            company: '',
            address_1: shippingInfo.address.street_line1,
            address_2: shippingInfo.address.street_line2 || '',
            city: shippingInfo.address.city,
            state: shippingInfo.address.state || '',
            postcode: shippingInfo.address.post_code,
            country: shippingInfo.address.country_code,
            email: shippingInfo.email || '',
            phone: shippingInfo.phone || ''
        }
    }
    return updateOrder(orderId, update)
}

function setOrderPaid(orderId: number) {
    const update = {
        set_paid: true,
    }
    return updateOrder(orderId, update)
}


async function getShippingOptions(zoneId: number) {
    const res = await woo.get(`shipping/zones/${zoneId}/methods`)
    const methods: any[] = await res.json()
    return methods.filter((method) => method.enabled)
        .map((method) => {
            return {
                id: method.method_id,
                title: method.method_title,
                prices: [{label: "Free", amount: 0}], //TODO: set price from shipping method
            }
        });
}

const woo = {
    get, createOrder, updateOrderInfo, setOrderPaid, getShippingOptions
}

export default woo