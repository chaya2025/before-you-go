# A server that accepts the connection and never answers.
# The only honest way to photograph a loading state: the request really is
# in flight, the app really is waiting, nothing is faked.
import socket, time

s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(('127.0.0.1', 3099))
s.listen(50)
print('hanging on 3099', flush=True)
held = []
while True:
    c, _ = s.accept()
    held.append(c)   # kept open, never written to
    time.sleep(0.01)
