// src/index.js

// Define CORS headers globally
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Error response helper function
function errorResponse(error, status = 500) {
  console.error(`[ERROR] ${error.message}`, {
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });

  return new Response(
    JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...CORS_HEADERS,
      },
    }
  );
}

export default {
  async fetch(request, env, ctx) {
    try {
      console.log(
        `[INFO] Incoming ${request.method} request to ${request.url}`
      );
      const url = new URL(request.url);

      // Handle OPTIONS requests
      if (request.method === "OPTIONS") {
        return new Response(null, {
          headers: CORS_HEADERS,
        });
      }

      // Route handling
      if (url.pathname === "/api/products" && request.method === "GET") {
        return await handleGetProducts(env.DB);
      } else if (
        url.pathname === "/api/orders/calculate" &&
        request.method === "POST"
      ) {
        return await handleCalculateOrder(request, env.DB);
      } else if (url.pathname === "/api/orders" && request.method === "POST") {
        return await handleCreateOrder(request, env.DB);
      } else if (
        url.pathname.startsWith("/api/orders/") &&
        request.method === "GET"
      ) {
        const orderTrackingId = url.pathname.split("/").pop();
        return await handleGetOrder(orderTrackingId, env.DB);
      } else if (url.pathname === "/" || url.pathname === "/dashboard") {
        return await handleDashboard(env.DB);
      }

      console.warn(`[WARN] Route not found: ${url.pathname}`);
      return new Response("Not Found", {
        status: 404,
        headers: CORS_HEADERS,
      });
    } catch (error) {
      return errorResponse(error);
    }
  },
};

async function handleGetProducts(db) {
  try {
    console.log("[INFO] Fetching all products");
    const products = await db
      .prepare("SELECT * FROM products ORDER BY category, name")
      .all();

    // Group products by category
    const productsByCategory = {};
    for (const product of products.results) {
      if (!productsByCategory[product.category]) {
        productsByCategory[product.category] = [];
      }
      productsByCategory[product.category].push(product);
    }

    console.log(
      `[INFO] Successfully fetched ${products.results.length} products`
    );
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          categories: productsByCategory,
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      }
    );
  } catch (error) {
    console.error("[ERROR] Failed to fetch products:", error);
    return errorResponse(error);
  }
}

async function handleCalculateOrder(request, db) {
  try {
    console.log("[INFO] Calculating order");
    const data = await request.json();

    if (!data.orderItems || !data.customerAddress) {
      console.warn("[WARN] Missing required fields in order calculation");
      return errorResponse(new Error("Missing required fields"), 400);
    }

    // Calculate total
    let subtotal = 0;
    const itemsDetail = [];

    for (const item of data.orderItems) {
      try {
        const product = await db
          .prepare("SELECT * FROM products WHERE itemId = ?")
          .bind(item.itemId)
          .first();

        if (!product) {
          console.warn(`[WARN] Product not found: ${item.itemId}`);
          return errorResponse(
            new Error(`Product ${item.itemId} not found`),
            400
          );
        }

        const itemTotal = product.price * item.itemQuantity;
        subtotal += itemTotal;
        itemsDetail.push({
          product,
          itemQuantity: item.itemQuantity,
          subtotal: Number(itemTotal.toFixed(2)),
        });
      } catch (error) {
        console.error(`[ERROR] Failed to process item ${item.itemId}:`, error);
        throw error;
      }
    }

    const deliveryFee = 5.0;
    const total = subtotal + deliveryFee;

    console.log(`[INFO] Order calculation completed. Total: ${total}`);
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          orderItems: itemsDetail,
          subtotal: Number(subtotal.toFixed(2)),
          delivery_fee: deliveryFee,
          total: Number(total.toFixed(2)),
          customerAddress: data.customerAddress,
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      }
    );
  } catch (error) {
    console.error("[ERROR] Order calculation failed:", error);
    return errorResponse(error);
  }
}

async function handleCreateOrder(request, db) {
  try {
    console.log("[INFO] Creating new order");
    const data = await request.json();

    if (!data.orderItems || !data.customerAddress) {
      console.warn("[WARN] Missing required fields in order creation");
      return errorResponse(new Error("Missing required fields"), 400);
    }

    // Calculate total (reuse calculation logic)
    const calculation = await handleCalculateOrder(
      new Request(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(data),
      }),
      db
    );

    const calculationData = await calculation.json();
    if (!calculationData.success) {
      console.warn("[WARN] Order calculation failed:", calculationData.error);
      return calculation;
    }

    const orderData = calculationData.data;
    const orderTrackingId = crypto.randomUUID();

    try {
      console.log("[INFO] Starting database transaction");

      // Use D1's transaction API
      await db.batch([
        // Insert order
        db
          .prepare(
            `
          INSERT INTO orders (
            orderTrackingId, customerAddress, subtotal, delivery_fee, 
            total, status, created_at, estimated_delivery_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
          )
          .bind(
            orderTrackingId,
            data.customerAddress,
            orderData.subtotal,
            orderData.delivery_fee,
            orderData.total,
            "new",
            new Date().toISOString(),
            "30-45 minutes"
          ),

        // Insert order items (prepare all statements at once)
        ...orderData.orderItems.map((item) =>
          db
            .prepare(
              `
            INSERT INTO order_items (
              orderTrackingId, itemId, itemQuantity, subtotal
            ) VALUES (?, ?, ?, ?)
          `
            )
            .bind(
              orderTrackingId,
              item.product.itemId,
              item.itemQuantity,
              item.subtotal
            )
        ),
      ]);

      console.log(`[INFO] Order created successfully: ${orderTrackingId}`);

      // Get complete order data for response
      const order = await getOrderDetails(db, orderTrackingId);

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            orderTrackingId,
            order,
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
            ...CORS_HEADERS,
          },
        }
      );
    } catch (error) {
      console.error("[ERROR] Transaction failed:", error);
      throw error;
    }
  } catch (error) {
    console.error("[ERROR] Order creation failed:", error);
    return errorResponse(error);
  }
}

async function handleGetOrder(orderTrackingId, db) {
  try {
    console.log(`[INFO] Fetching order: ${orderTrackingId}`);
    const order = await getOrderDetails(db, orderTrackingId);

    if (!order) {
      console.warn(`[WARN] Order not found: ${orderTrackingId}`);
      return errorResponse(new Error("Order not found"), 404);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          order,
        },
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...CORS_HEADERS,
        },
      }
    );
  } catch (error) {
    console.error(`[ERROR] Failed to fetch order ${orderTrackingId}:`, error);
    return errorResponse(error);
  }
}

async function getOrderDetails(db, orderTrackingId) {
  try {
    const order = await db
      .prepare(
        `
        SELECT * FROM orders WHERE orderTrackingId = ?
      `
      )
      .bind(orderTrackingId)
      .first();

    if (!order) {
      console.warn(`[WARN] Order details not found: ${orderTrackingId}`);
      return null;
    }

    // Get order items with product details
    const items = await db
      .prepare(
        `
        SELECT oi.*, p.*
        FROM order_items oi
        JOIN products p ON oi.itemId = p.itemId
        WHERE oi.orderTrackingId = ?
      `
      )
      .bind(orderTrackingId)
      .all();

    console.log(
      `[INFO] Successfully fetched order details: ${orderTrackingId}`
    );
    return {
      ...order,
      orderItems: items.results.map((item) => ({
        itemQuantity: item.itemQuantity,
        subtotal: item.subtotal,
        product: {
          itemId: item.itemId,
          name: item.name,
          price: item.price,
          description: item.description,
          category: item.category,
        },
      })),
    };
  } catch (error) {
    console.error(
      `[ERROR] Failed to get order details for ${orderTrackingId}:`,
      error
    );
    throw error;
  }
}

async function handleDashboard(db) {
  try {
    console.log("[INFO] Loading dashboard");
    const orders = await db
      .prepare(
        `
        SELECT * FROM orders ORDER BY created_at DESC
      `
      )
      .all();

    // Get items for all orders
    for (const order of orders.results) {
      try {
        order.orderItems = (
          await db
            .prepare(
              `
              SELECT oi.*, p.*
              FROM order_items oi
              JOIN products p ON oi.itemId = p.itemId
              WHERE oi.orderTrackingId = ?
            `
            )
            .bind(order.orderTrackingId)
            .all()
        ).results.map((item) => ({
          itemQuantity: item.itemQuantity,
          subtotal: item.subtotal,
          product: {
            itemId: item.itemId,
            name: item.name,
            price: item.price,
            description: item.description,
            category: item.category,
          },
        }));
      } catch (error) {
        console.error(
          `[ERROR] Failed to fetch items for order ${order.orderTrackingId}:`,
          error
        );
        order.orderItems = []; // Fallback to empty items on error
      }
    }

    // Render dashboard HTML
    console.log(
      `[INFO] Rendering dashboard with ${orders.results.length} orders`
    );
    const html = generateDashboardHtml(orders.results);

    return new Response(html, {
      headers: {
        "Content-Type": "text/html",
        ...CORS_HEADERS,
      },
    });
  } catch (error) {
    console.error("[ERROR] Dashboard generation failed:", error);
    return new Response(
      `<html><body><h1>Error</h1><p>${error.message}</p></body></html>`,
      {
        status: 500,
        headers: {
          "Content-Type": "text/html",
          ...CORS_HEADERS,
        },
      }
    );
  }
}

function generateDashboardHtml(orders) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Agustin Pizzeria - Orders Dashboard</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <script>
        function refreshDashboard() {
          location.reload();
        }
        setInterval(refreshDashboard, 30000);
      </script>
    </head>
    <body class="bg-gray-100">
      <div class="container mx-auto px-4 py-8">
        <header class="mb-8">
          <h1 class="text-3xl font-bold text-gray-800">Agustin Pizzeria</h1>
          <p class="text-gray-600">Orders Dashboard</p>
        </header>
  
        <div class="bg-white rounded-lg shadow-lg p-6">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-semibold">Recent Orders</h2>
            <button
              onclick="refreshDashboard()"
              class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Refresh
            </button>
          </div>
  
          <div class="overflow-x-auto">
            <table class="min-w-full table-auto">
              <thead>
                <tr class="bg-gray-50">
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Tracking ID</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Items</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer Address</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                ${orders
                  .map(
                    (order) => `
                  <tr class="hover:bg-gray-50">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${order.orderTrackingId.slice(0, 8)}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                      ${order.orderItems
                        .map(
                          (item) => `${item.itemQuantity}x ${item.product.name}`
                        )
                        .join("<br>")}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      $${order.total.toFixed(2)}
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                      ${order.customerAddress}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${
                          order.status === "new"
                            ? "bg-blue-100 text-blue-800"
                            : order.status === "preparing"
                            ? "bg-yellow-100 text-yellow-800"
                            : order.status === "delivering"
                            ? "bg-purple-100 text-purple-800"
                            : order.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : ""
                        }">
                        ${order.status}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${order.created_at.split("T")[0]} ${order.created_at
                      .split("T")[1]
                      .slice(0, 5)}
                    </td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </body>
  </html>`;
}
