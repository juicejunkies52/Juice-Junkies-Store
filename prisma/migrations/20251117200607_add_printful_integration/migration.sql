-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalAmount" REAL NOT NULL,
    "shippingAddress" TEXT NOT NULL,
    "billingAddress" TEXT NOT NULL,
    "stripePaymentIntentId" TEXT,
    "fulfillmentStatus" TEXT NOT NULL DEFAULT 'unfulfilled',
    "printfulOrderId" TEXT,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "shippedAt" DATETIME,
    "estimatedDelivery" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("billingAddress", "createdAt", "id", "shippingAddress", "status", "stripePaymentIntentId", "totalAmount", "updatedAt", "userId") SELECT "billingAddress", "createdAt", "id", "shippingAddress", "status", "stripePaymentIntentId", "totalAmount", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL,
    "compareAtPrice" REAL,
    "images" TEXT NOT NULL,
    "inventoryQty" INTEGER NOT NULL DEFAULT 0,
    "sku" TEXT,
    "tags" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "categoryId" TEXT,
    "fulfillmentType" TEXT NOT NULL DEFAULT 'manual',
    "printfulId" TEXT,
    "printfulExtId" TEXT,
    "designFiles" TEXT NOT NULL DEFAULT '[]',
    "mockupImages" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Product" ("categoryId", "compareAtPrice", "createdAt", "description", "id", "images", "inventoryQty", "name", "price", "sku", "slug", "status", "tags", "updatedAt") SELECT "categoryId", "compareAtPrice", "createdAt", "description", "id", "images", "inventoryQty", "name", "price", "sku", "slug", "status", "tags", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
