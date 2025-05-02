"use client"
import {useCallback, useEffect} from "react";
import {useTelegram} from "@/providers/telegram-provider";
import {useAppContext} from "@/providers/context-provider";
import StoreFront from "@/components/store-front";
import OrderOverview from "@/components/order-overview";
import ProductOverview from "@/components/product-overview";

type OrderItem = {
    id: number;
    count: number;
}

type PaymentStatus = 'paid' | 'failed' | 'unknown';

export default function Home() {
    const {webApp, user} = useTelegram()
    const {state, dispatch} = useAppContext()

    const handleCheckout = useCallback(async () => {
        webApp?.MainButton.showProgress()
        const items: OrderItem[] = Array.from(state.cart.values()).map((item) => ({
            id: item.product.id,
            count: item.count
        }))
        
        const body = JSON.stringify({
            userId: user?.id,
            chatId: webApp?.initDataUnsafe.chat?.id,
            comment: state.comment,
            shippingZone: state.shippingZone,
            paymentMethod: state.paymentMethod,
            items
        })

        try {
            const res = await fetch("api/orders", {method: "POST", body})
            const result = await res.json()

            if (result.payment_method === 'cod') {
                webApp?.MainButton.hideProgress()
                webApp?.showAlert(`Order #${result.order_id} has been placed successfully! You will pay on delivery.`)
                webApp?.close()
                return
            }

            // Handle Telegram payment
            const invoiceSupported = webApp?.isVersionAtLeast('6.1')
            if (!invoiceSupported) {
                webApp?.showAlert("Telegram payment requires app version 6.1 or higher. Please update your Telegram app!")
                webApp?.MainButton.hideProgress()
                return
            }

            webApp?.openInvoice(result.invoice_link, (status) => {
                webApp?.MainButton.hideProgress()
                if (status === 'paid') {
                    console.log("[paid] InvoiceStatus " + result.order_id)
                    webApp?.close()
                } else if (status === 'failed') {
                    console.log("[failed] InvoiceStatus " + result.order_id)
                    webApp?.HapticFeedback.notificationOccurred('error')
                } else if (status === 'cancelled') {
                    console.log("[cancelled] InvoiceStatus " + result.order_id)
                    webApp?.HapticFeedback.notificationOccurred('warning')
                } else if (status === 'pending') {
                    console.log("[pending] InvoiceStatus " + result.order_id)
                    webApp?.HapticFeedback.notificationOccurred('warning')
                }
            })
        } catch (error) {
            console.error('Checkout error:', error)
            webApp?.showAlert("An error occurred while processing your order!")
            webApp?.MainButton.hideProgress()
        }
    }, [webApp, user, state.cart, state.comment, state.shippingZone, state.paymentMethod])

    useEffect(() => {
        const callback = state.mode === "order" ? handleCheckout :
            () => dispatch({type: "order"})
        webApp?.MainButton.setParams({
            text_color: '#fff',
            color: '#31b545'
        }).onClick(callback)
        webApp?.BackButton.onClick(() => dispatch({type: "storefront"}))
        return () => {
            //prevent multiple call
            webApp?.MainButton.offClick(callback)
        }
    }, [webApp, state.mode, handleCheckout])

    useEffect(() => {
        if (state.mode === "storefront")
            webApp?.BackButton.hide()
        else
            webApp?.BackButton.show()

        if (state.mode === "order")
            webApp?.MainButton.setText("CHECKOUT")
        else
            webApp?.MainButton.setText("VIEW ORDER")
    }, [state.mode])

    useEffect(() => {
        if (state.cart.size !== 0) {
            webApp?.MainButton.show()
            webApp?.enableClosingConfirmation()
        } else {
            webApp?.MainButton.hide()
            webApp?.disableClosingConfirmation()
        }
    }, [state.cart.size])

    return (
        <main className={`${state.mode}-mode`}>
            <StoreFront/>
            <ProductOverview/>
            <OrderOverview/>
        </main>
    )
}
