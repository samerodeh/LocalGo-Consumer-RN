"""Goer — LocalGO's multi-agent ordering assistant.

Architecture ported from the SufraAI restaurant chatbot: a guard agent gates
each turn, a router agent picks a specialist, and the specialist answers with
ChromaDB retrieval over the menu and FAQ plus a Groq-hosted Llama model.

    routers/goer.py  ->  router_agent.run_turn / stream_turn
                             |
                             +-- guard_agent      (on-topic gate)
                             +-- route            (which specialist)
                             +-- menu_agent       (Menu Concierge)
                             +-- cart_agent       (Cart Manager)
                             +-- checkout_agent   (Checkout)
                             +-- tracker_agent    (Order Tracker)
                             +-- dietary_agent    (Dietary Advisor)
                             +-- recommendation_agent (Apriori + popularity)

The cart itself lives on the phone, so specialists return `actions` — calls to
the client's existing tool executors — rather than mutating server state.
"""

from .router_agent import RouterAgent, router, router_stream, run_turn, stream_turn

__all__ = ["RouterAgent", "router", "router_stream", "run_turn", "stream_turn"]
