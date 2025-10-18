'use client';

import * as React from 'react'
import { useTelegram } from './telegram-provider';

type Action =
    | { type: "mode", mode: Mode }
    | { type: "storefront" }
    | { type: "order" }
    | { type: "item", product: Product }
    | { type: "loading" }
    | { type: "products", products: Product[], hasMore: boolean, page: number, categoryId?: number }
    | { type: "categories", categories: Category[] }
    | { type: "select-cat", category: Category }
    | { type: "inc", product: Product }
    | { type: "dec", product: Product }
    | { type: "comment", comment: string }
    | { type: "payment-method", method: PaymentMethod }
    | { type: "shipping-info", field: string, value: string }
    | { type: "shipping-address", field: string, value: string }

type Dispatch = (action: Action) => void

type Mode = 'storefront' | 'order' | 'item'
type PaymentMethod = 'prepayment' | 'telegram'

export type CartItem = {
    product: Product,
    count: number,
}

export type Product = {
    id: number,
    name: string,
    description: string,
    short_description: string,
    price: string,
    regular_price: string,
    sale_price: string,
    price_html: string,
    images: any[],
}

export type Category = {
    id: number,
    name: string,
    count: number,
}

type State = {
    mode: Mode
    loading: boolean
    products: Product[]
    page: number
    hasMore: boolean
    categories: Category[]
    selectedCategory?: Category
    selectedProduct?: Product
    cart: Map<number, CartItem>
    comment?: string,
    shippingZone: number,
    paymentMethod: PaymentMethod
    shippingInfo: {
        name: string
        email?: string
        phone?: string
        address: {
            street_line1: string
            street_line2?: string
            city: string
            state?: string
            country_code: string
            post_code: string
        }
    }
}

const StateContext = React.createContext<{ state: State; dispatch: Dispatch } | undefined>(undefined)

function contextReducer(state: State, action: Action) {
    switch (action.type) {
        case 'mode': {
            state.mode = action.mode
            break
        }
        case 'item':
            state.selectedProduct = action.product
        case 'storefront':
        case 'order': {
            state.mode = action.type
            break
        }

        case 'loading' : {
            state.loading = true
            break
        }
        case 'products': {
            if (
                state.selectedCategory?.id !== action.categoryId ||
                state.page !== action.page - 1
            )
                return state;
            state.products.push(...action.products)
            state.page = action.page
            state.loading = false
            state.hasMore = action.hasMore
            break
        }
        case 'categories': {
            state.categories = action.categories
            break
        }
        case 'select-cat': {
            state.products = new Array(0)
            state.page = 0
            state.loading = true
            state.hasMore = true
            if (state.selectedCategory?.id === action.category.id)
                state.selectedCategory = undefined
            else
                state.selectedCategory = action.category
            break
        }
        case 'inc': {
            const count = state.cart.get(action.product.id)?.count || 0
            state.cart.set(action.product.id, {product: action.product, count: count + 1})
            break
        }
        case 'dec': {
            const count = state.cart.get(action.product.id)?.count || 0
            if (count <= 1)
                state.cart.delete(action.product.id)
            else
                state.cart.set(action.product.id, {product: action.product, count: count - 1})
            break
        }
        case 'comment': {
            state.comment = action.comment
            break
        }
        case 'payment-method': {
            state.paymentMethod = action.method
            break
        }
        case 'shipping-info': {
            state.shippingInfo = {
                ...state.shippingInfo,
                [action.field]: action.value
            } as State['shippingInfo'] // Type assertion to satisfy TypeScript
            break
        }
        case 'shipping-address': {
            state.shippingInfo = {
                ...state.shippingInfo,
                address: {
                    ...state.shippingInfo?.address,
                    [action.field]: action.value
                }
            }
            break
        }
        default: {
            throw new Error(`Unhandled action: ${action}`)
        }
    }
    return {
        ...state
    }
}

function ContextProvider({children}: {
    children: React.ReactNode
}) {
    const { user } = useTelegram();

    const init = React.useMemo(() => ({
        mode: "storefront",
        loading: true,
        products: Array(0),
        page: 0,
        hasMore: true,
        categories: [],
        cart: new Map<number, CartItem>(),
        shippingZone: 1,
        paymentMethod: 'prepayment',
        shippingInfo: {
            name: user?.username || 'Guest',
            email: 'default@example.com',
            phone: '0000000000',
            address: {
                street_line1: '',
                street_line2: 'N/A',
                city: 'Default City',
                state: 'Default State',
                country_code: 'US',
                post_code: '00000'
            }
        }
    } as State), []);

    const [state, dispatch] = React.useReducer(contextReducer, init);

    // Update shipping info when user data changes
    React.useEffect(() => {
        if (user?.username) {
            dispatch({
                type: 'shipping-info',
                field: 'name',
                value: `@${user.username}`
            });
        }
    }, [user]);

    const context = {state, dispatch}
    return (
        <StateContext.Provider value={context}>
            {children}
        </StateContext.Provider>
    )
}

function useAppContext() {
    const context = React.useContext(StateContext)
    if (context === undefined) {
        throw new Error('useContext must be used within a ContextProvider')
    }
    return context
}

const PER_PAGE = 12

function fetchProducts(state: State, dispatch: Dispatch) {
    dispatch({type: "loading"})
    const page = (state.page + 1)
    const categoryId = state.selectedCategory?.id
    let url = "api/products?per_page=" + PER_PAGE + "&page=" + page
    //other types not supported yet!
    url = url + "&type=simple"
    if (categoryId)
        url = url + "&category=" + categoryId
    fetch(url, {method: "GET"}).then((res) =>
        res.json().then((products) => {
            const hasMore = products.length === PER_PAGE
            dispatch({type: "products", products, page, hasMore, categoryId})
        })
    )
}

function fetchCategories(dispatch: Dispatch) {
    fetch("api/categories?per_page=30", {method: "GET"}).then((res) =>
        res.json().then((categories) => dispatch({type: "categories", categories}))
    )
}

export {ContextProvider, useAppContext, fetchProducts, fetchCategories}