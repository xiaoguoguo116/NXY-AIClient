"""Temporary TLS passthrough for the existing DeepSeek endpoint.

FD 9 is the Docker host network namespace; FD 8 is the working WSL namespace.
Only a listener on the existing RAG bridge is created. TLS stays end-to-end.
No request bodies, headers, or credentials are inspected or logged.
"""
import ipaddress
import os
import select
import socket
import sys
import threading

upstream = str(ipaddress.IPv4Address(sys.argv[1]))
listen_address = str(ipaddress.IPv4Address(sys.argv[2]))
os.setns(9, os.CLONE_NEWNET)
listener = socket.socket()
listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
listener.bind((listen_address, 443))
listener.listen(32)
os.setns(8, os.CLONE_NEWNET)
os.close(8)
os.close(9)
slots = threading.BoundedSemaphore(32)


def forward(client):
    peer = None
    try:
        peer = socket.create_connection((upstream, 443), timeout=10)
        client.settimeout(15)
        peer.settimeout(15)
        active = [client, peer]
        while active:
            ready, _, _ = select.select(active, [], [], 180)
            if not ready:
                return
            for source in ready:
                target = peer if source is client else client
                data = source.recv(65536)
                if data:
                    target.sendall(data)
                else:
                    active.remove(source)
                    target.shutdown(socket.SHUT_WR)
    except OSError as error:
        print('Relay connection ended:', type(error).__name__, flush=True)
    finally:
        client.close()
        if peer:
            peer.close()
        slots.release()


print('TLS passthrough ready:', listen_address, '->', upstream, flush=True)
while True:
    client, _ = listener.accept()
    if not slots.acquire(blocking=False):
        client.close()
        continue
    threading.Thread(target=forward, args=(client,), daemon=True).start()
