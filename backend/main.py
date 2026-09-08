from fastapi import FastAPI
from sqlalchemy import text
from pydantic import BaseModel


from database import engine

app = FastAPI()


@app.get("/")
def home():
    return {"message": "Mandi Marketplace API is running"}


@app.get("/test-db")
def test_database():
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))

    return {"message": "Database connected successfully"}


@app.get("/listings")
def get_listings():
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT * FROM listings ORDER BY id DESC")
        )

        listings = [dict(row._mapping) for row in result]

    return listings

class Listing(BaseModel):
    commodity: str
    state: str
    market: str
    quantity: float
    starting_price: float
    predicted_price: float = 0


@app.post("/listings")
def create_listing(listing: Listing):
    with engine.begin() as connection:
        result = connection.execute(
            text("""
                INSERT INTO listings
                (commodity, state, market, quantity, starting_price, predicted_price)
                VALUES
                (:commodity, :state, :market, :quantity, :starting_price, :predicted_price)
                RETURNING id
            """),
            {
                "commodity": listing.commodity,
                "state": listing.state,
                "market": listing.market,
                "quantity": listing.quantity,
                "starting_price": listing.starting_price,
                "predicted_price": listing.predicted_price
            }
        )

        listing_id = result.scalar()

    return {
        "message": "Listing created successfully",
        "id": listing_id
    }

class Bid(BaseModel):
    listing_id: int
    bidder_name: str
    amount: float

@app.post("/bids")
def create_bid(bid: Bid):
    with engine.begin() as connection:
        result = connection.execute(
            text("""
                INSERT INTO bids
                (listing_id, bidder_name, amount)
                VALUES
                (:listing_id, :bidder_name, :amount)
                RETURNING id
            """),
            {
                "listing_id": bid.listing_id,
                "bidder_name": bid.bidder_name,
                "amount": bid.amount
            }
        )

        bid_id = result.scalar()

    return {
        "message": "Bid created successfully",
        "id": bid_id
    }

@app.get("/bids")
def get_bids():
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT * FROM bids ORDER BY id DESC")
        )

        bids = [dict(row._mapping) for row in result]

    return bids

class PriceRequest(BaseModel):
    commodity: str
    starting_price: float


@app.post("/predict-price")
def predict_price(data: PriceRequest):
    predicted_price = data.starting_price * 1.05

    return {
        "commodity": data.commodity,
        "starting_price": data.starting_price,
        "predicted_price": round(predicted_price, 2)
    }
