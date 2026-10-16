import React, { useCallback, useEffect, useRef, useState } from 'react';
import { func, shape, string } from 'prop-types';

import RadioInput from '../../components/common/Form/RadioInput';
import { __ } from '../../i18n';
import { config } from '../../config';
import { placeOrderRequest } from '../../api';
import { GraphQLResponseException } from '../../api/utility';
import { _isObjEmpty } from '../../utils';
import { isCartAddressValid } from '../../utils/address';
import LocalStorage from '../../utils/localStorage';
import useAppContext from '../../hook/useAppContext';
import useCartContext from '../../hook/useCartContext';
import useCheckoutFormContext from '../../hook/useCheckoutFormContext';
import {
  METHOD,
  createPaymentOrder,
  fetchSmartButtonsConfig,
  setSmartButtonsPayment,
} from './api';
import loadPaypalSdk from './sdk';

/**
 * PayPal Smart Buttons (Adobe Payment Services) for the Hyvä React Checkout.
 *
 * PayPal's own buttons (PayPal / Pay Later / Venmo, as PayPal deems eligible)
 * replace the checkout's "Place Order" for this method: clicking one creates a
 * Payment Services order for the cart, and approving it in the PayPal window
 * sets the payment on the cart and places the order.
 */
function PaypalSmartButtons({ method, selected, actions }) {
  const isSelected = selected?.code === METHOD;
  const { appDispatch, setErrorMessage, setPageLoader } = useAppContext();
  const { cart } = useCartContext();
  const { registerPaymentAction } = useCheckoutFormContext();
  const container = useRef(null);
  const paymentsOrder = useRef({});
  const latestCart = useRef(cart);
  latestCart.current = cart;
  const [status, setStatus] = useState('idle');

  const showError = useCallback(
    (error, fallback) => {
      if (!(error instanceof GraphQLResponseException)) {
        setErrorMessage(error?.message || fallback);
      }
    },
    [setErrorMessage]
  );

  useEffect(() => {
    registerPaymentAction(METHOD, async () => {
      setErrorMessage(
        __('Please use the PayPal button to complete your payment.')
      );
      return {};
    });
  }, [registerPaymentAction, setErrorMessage]);

  useEffect(() => {
    if (!isSelected || !container.current) {
      return undefined;
    }
    let buttons = null;
    let cancelled = false;

    (async () => {
      try {
        setStatus('loading');
        const buttonsConfig = await fetchSmartButtonsConfig(appDispatch);
        if (!buttonsConfig?.is_visible) {
          throw new Error(__('PayPal is not available.'));
        }
        const paypal = await loadPaypalSdk(buttonsConfig.sdk_params);
        if (cancelled) {
          return;
        }
        const styles = buttonsConfig.button_styles || {};
        buttons = paypal.Buttons({
          style: {
            layout: styles.layout || 'vertical',
            color: styles.color || 'gold',
            shape: styles.shape || 'rect',
            label: styles.label || 'paypal',
            tagline: styles.layout === 'horizontal' ? !!styles.tagline : false,
            ...(styles.use_default_height || !styles.height
              ? {}
              : { height: styles.height }),
          },
          onClick: (data, buttonActions) => {
            const current = latestCart.current || {};
            const ready =
              !!current.email &&
              isCartAddressValid(current.billing_address) &&
              (current.isVirtualCart ||
                (isCartAddressValid(current.shipping_address) &&
                  !_isObjEmpty(current.selected_shipping_method)));
            if (!ready) {
              setErrorMessage(
                __(
                  'Please complete your email, addresses and shipping method before paying with PayPal.'
                )
              );
              return buttonActions.reject();
            }
            return buttonActions.resolve();
          },
          createOrder: async (data) => {
            const paymentSource = data?.paymentSource || 'paypal';
            const order = await createPaymentOrder(appDispatch, paymentSource);
            paymentsOrder.current = {
              paymentSource,
              paymentsOrderId: order.mp_order_id,
            };
            return order.id;
          },
          onApprove: async (data) => {
            try {
              setPageLoader(true);
              await setSmartButtonsPayment(appDispatch, {
                payment_source: paymentsOrder.current.paymentSource,
                payments_order_id: paymentsOrder.current.paymentsOrderId,
                paypal_order_id: data.orderID,
              });
              const order = await placeOrderRequest(appDispatch);
              if (order?.order_number) {
                LocalStorage.clearCheckoutStorage();
                window.location.replace(config.successPageRedirectUrl);
                return;
              }
              throw new Error(__('Your order could not be placed.'));
            } catch (error) {
              setPageLoader(false);
              showError(error, __('Your order could not be placed.'));
            }
          },
          onCancel: () => {
            paymentsOrder.current = {};
          },
          onError: (error) => {
            setPageLoader(false);
            showError(
              error,
              __('PayPal could not complete the payment. Please try again.')
            );
          },
        });
        if (!buttons.isEligible()) {
          throw new Error(__('PayPal is not available for this order.'));
        }
        await buttons.render(container.current);
        setStatus('ready');
      } catch (error) {
        if (!cancelled) {
          setStatus('error');
          showError(error, __('PayPal is not available.'));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (buttons && typeof buttons.close === 'function') {
        buttons.close().catch(() => {});
      }
    };
  }, [isSelected, appDispatch, setErrorMessage, setPageLoader, showError]);

  return (
    <div>
      <RadioInput
        value={method.code}
        label={method.title}
        name="paymentMethod"
        checked={isSelected}
        onChange={actions.change}
      />
      {isSelected && (
        <div className="mt-3 mb-2 ml-6">
          {status === 'loading' && (
            <p className="text-sm text-gray-500">{__('Loading PayPal...')}</p>
          )}
          {status === 'error' && (
            <p className="text-sm text-red-600">
              {__('PayPal is not available right now.')}
            </p>
          )}
          <div ref={container} className="max-w-md" />
        </div>
      )}
    </div>
  );
}

PaypalSmartButtons.propTypes = {
  method: shape({ code: string, title: string }).isRequired,
  selected: shape({ code: string }),
  actions: shape({ change: func }).isRequired,
};

PaypalSmartButtons.defaultProps = {
  selected: {},
};

export default PaypalSmartButtons;
