"use client"
import React, { ChangeEvent } from 'react';
import {useAppContext} from "@/providers/context-provider";
import OrderItem from "@/components/order-item";

interface ShippingInfo {
    name: string;
    email: string;
    phone: string;
    address: {
        street_line1: string;
        street_line2: string;
        city: string;
        state: string;
        country_code: string;
        post_code: string;
    };
}

export default function OrderOverview() {
    const {state, dispatch} = useAppContext()

    const items = Array.from(state.cart.values())
        .map((cartItem) => <OrderItem key={cartItem.product.id} id={cartItem.product.id}/>)

    const handleCommentChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        dispatch({type: "comment", comment: e.target.value})
    }

    const handleShippingInfoChange = (field: string, value: string) => {
        dispatch({type: "shipping-info", field, value})
    }

    const handleAddressChange = (field: string, value: string) => {
        dispatch({type: "shipping-address", field, value})
    }

    return (
        <section className="order-overview">
            <div className="order-block">
                <div className="order-header-wrap">
                    <h2 className="order-header">Your Order</h2>
                    <span className="order-edit"
                          onClick={() => dispatch({type: "storefront"})}>Edit</span>
                </div>
                <div className="order-items">
                    {items}
                </div>
            </div>
            <div className="order-block">
                <div className="order-header-wrap">
                    <h2 className="order-header">Payment Method</h2>
                </div>
                <div className="payment-methods">
                    <div 
                        className={`payment-method ${state.paymentMethod === 'cod' ? 'selected' : ''}`}
                        onClick={() => dispatch({type: "payment-method", method: 'cod'})}
                    >
                        <span className="payment-method-title">Cash on Delivery</span>
                        <span className="payment-method-desc">Pay when you receive your order</span>
                    </div>
                    <div 
                        className={`payment-method ${state.paymentMethod === 'telegram' ? 'selected' : ''}`}
                        onClick={() => dispatch({type: "payment-method", method: 'telegram'})}
                    >
                        <span className="payment-method-title">Pay via Telegram</span>
                        <span className="payment-method-desc">Secure payment through Telegram</span>
                    </div>
                </div>
            </div>
            {state.paymentMethod === 'cod' && (
                <div className="order-block shipping-info">
                    <div className="order-header-wrap">
                        <h2 className="order-header">Shipping Information</h2>
                    </div>
                    <div className="shipping-form">
                        <input
                            type="text"
                            className="order-text-field"
                            placeholder="Full Name *"
                            onChange={(e) => handleShippingInfoChange('name', e.target.value)}
                            value={state.shippingInfo?.name || ''}
                            required
                        />
                        <input
                            type="text"
                            className="order-text-field"
                            placeholder="Street Address *"
                            onChange={(e) => handleAddressChange('street_line1', e.target.value)}
                            value={state.shippingInfo?.address?.street_line1 || ''}
                            required
                        />
                    </div>
                </div>
            )}
            <div className="order-text-field-wrap">
                <textarea
                    className="order-text-field order-block"
                    rows={1}
                    placeholder="Add comment…"
                    onChange={handleCommentChange}
                    value={state.comment || ''}
                ></textarea>
                <div className="order-text-field-hint">
                    Any special requests, details, final wishes etc.
                </div>
            </div>
        </section>
    )
}
